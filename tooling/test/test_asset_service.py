import fcntl
import os
import pathlib
import plistlib
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / 'launchkit/scripts'))
import asset_service as s


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.root = pathlib.Path(tempfile.mkdtemp(prefix='asset-installer-test-')).resolve()
        self.repo = self.root / 'repo'
        self.repo.mkdir()
        subprocess.run(['git', 'init', '-q', str(self.repo)], check=True)
        for name in s.FILES:
            path = self.repo / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('fixture ' + name + '\n')
        self.sha = self.commit()
        self.state = self.root / 'private state'
        self.agents = self.root / 'LaunchAgents'
        self.fleet = self.root / 'Fleet & things'
        self.fleet.mkdir()
        self.index = self.root / 'Drive & things/index.json'
        self.index.parent.mkdir()
        self.index.write_text('{}')
        self.calls = []
        self.bootstrap_failures = 0
        self.loaded = False
        self.kwargs = dict(repo=str(self.repo), sha=self.sha, state=str(self.state),
                           fleet=str(self.fleet), index=str(self.index), node='/opt/homebrew/bin/node',
                           codex=str(pathlib.Path.home()/'.local/bin/codex'), python='/usr/bin/python3',
                           agents=str(self.agents), uid=501)

    def commit(self):
        subprocess.run(['git', '-C', str(self.repo), 'add', '.'], check=True)
        subprocess.run(['git', '-C', str(self.repo), '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture'], check=True)
        return subprocess.check_output(['git', '-C', str(self.repo), 'rev-parse', 'HEAD']).decode().strip()

    def fake_run(self, argv, **kwargs):
        if argv[0] == 'git':
            return subprocess.run(argv, check=False, capture_output=True, **kwargs)
        self.calls.append(argv)
        if argv[:2] == ['/bin/launchctl', 'print']:
            out = (f'path = {self.agents / (s.LABEL + ".plist")}\n'.encode() if self.loaded else b'')
            return subprocess.CompletedProcess(argv, 0 if self.loaded else 1, out, b'')
        if argv[:2] == ['/bin/launchctl', 'bootstrap'] and self.bootstrap_failures:
            self.bootstrap_failures -= 1
            return subprocess.CompletedProcess(argv, 1, b'', b'failure')
        return subprocess.CompletedProcess(argv, 0, b'', b'')

    def test_plan_is_read_only_and_plist_handles_spaces_and_xml(self):
        with patch.object(s, 'run', side_effect=self.fake_run):
            files, plist = s.plan(**{k: v for k, v in self.kwargs.items() if k not in ('agents', 'uid')})
        self.assertEqual(len(files), len(s.FILES))
        self.assertEqual(plistlib.loads(plistlib.dumps(plist)), plist)
        self.assertEqual(plist['EnvironmentVariables']['FLEET_ASSET_INDEX'], str(self.index))
        self.assertFalse(self.state.exists())

    @unittest.skipUnless(sys.platform == 'darwin', 'requires macOS plutil')
    def test_generated_plist_passes_native_plutil(self):
        with patch.object(s, 'run', side_effect=self.fake_run):
            _, plist = s.plan(**{k: v for k, v in self.kwargs.items() if k not in ('agents', 'uid')})
        target = self.root / 'candidate.plist'
        target.write_bytes(plistlib.dumps(plist))
        subprocess.run(['/usr/bin/plutil', '-lint', str(target)], check=True, capture_output=True)

    def test_release_with_unexpected_file_is_not_reused(self):
        with patch.object(s, 'run', side_effect=self.fake_run):
            files, _ = s.plan(**{k: v for k, v in self.kwargs.items() if k not in ('agents', 'uid')})
            root = s.private_dir(self.state)
            release = s.stage_release(root, self.sha, files)
            os.chmod(release, 0o700)
            (release / 'unexpected').write_text('keep')
            with self.assertRaisesRegex(RuntimeError, 'unexpected'):
                s.stage_release(root, self.sha, files)

    def test_first_install_stages_committed_bytes_and_preserves_other_agents(self):
        self.agents.mkdir()
        unrelated = self.agents / 'another.plist'; unrelated.write_text('keep')
        with patch.object(s, 'run', side_effect=self.fake_run):
            installed = s.install(**self.kwargs)
        self.assertTrue(installed.is_file())
        self.assertEqual(unrelated.read_text(), 'keep')
        self.assertEqual(s.owned_plist(installed, self.state), installed.read_bytes())
        release = self.state / 'releases' / self.sha
        self.assertEqual((release / s.FILES[0]).read_bytes(), (self.repo / s.FILES[0]).read_bytes())
        self.assertEqual((installed.stat().st_mode & 0o777), 0o600)

    def test_existing_unowned_plist_is_not_changed_or_booted_out(self):
        self.agents.mkdir()
        target = self.agents / (s.LABEL + '.plist')
        target.write_bytes(plistlib.dumps({'Label': s.LABEL, 'ProgramArguments': ['/unrelated']}))
        before = target.read_bytes()
        with patch.object(s, 'run', side_effect=self.fake_run), self.assertRaisesRegex(RuntimeError, 'unowned'):
            s.install(**self.kwargs)
        self.assertEqual(target.read_bytes(), before)
        self.assertFalse(any(a[:2] == ['/bin/launchctl', 'bootout'] for a in self.calls))

    def test_active_lock_prevents_replacement_or_bootout(self):
        self.state.mkdir()
        fd = os.open(self.state / 'watch.lock', os.O_CREAT | os.O_RDWR, 0o600)
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            with patch.object(s, 'run', side_effect=self.fake_run), self.assertRaisesRegex(RuntimeError, 'holds the lock'):
                s.install(**self.kwargs)
        finally:
            os.close(fd)
        self.assertFalse(any(a[:2] == ['/bin/launchctl', 'bootout'] for a in self.calls))

    def test_failed_update_restores_original_plist_and_restarts_only_owned_job(self):
        with patch.object(s, 'run', side_effect=self.fake_run):
            target = s.install(**self.kwargs)
            original = target.read_bytes()
            (self.repo / s.FILES[0]).write_text('changed fixture')
            self.kwargs['sha'] = self.commit()
            self.loaded = True
            self.bootstrap_failures = 1
            with self.assertRaisesRegex(RuntimeError, 'Command failed'):
                s.install(**self.kwargs)
        self.assertEqual(target.read_bytes(), original)
        self.assertEqual((self.state / 'previous.plist').read_bytes(), original)
        self.assertEqual(sum(a[:2] == ['/bin/launchctl', 'bootout'] for a in self.calls), 1)
        self.assertEqual(sum(a[:2] == ['/bin/launchctl', 'bootstrap'] for a in self.calls), 3)

    def test_owned_running_service_is_stopped_and_drained_before_upgrade(self):
        with patch.object(s, 'run', side_effect=self.fake_run):
            target = s.install(**self.kwargs)
        self.loaded = True
        fd = os.open(self.state / 'watch.lock', os.O_CREAT | os.O_RDWR, 0o600)
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        released = []
        def stopping(argv, **kwargs):
            if argv[:2] == ['/bin/launchctl', 'bootout']:
                os.close(fd); released.append(True)
            return self.fake_run(argv, **kwargs)
        try:
            with patch.object(s, 'run', side_effect=stopping):
                s.install(**self.kwargs)
        finally:
            if not released: os.close(fd)
        self.assertTrue(released)
        self.assertTrue(target.is_file())

    def test_failed_drain_reloads_previous_owned_service_without_replacing_plist(self):
        with patch.object(s, 'run', side_effect=self.fake_run):
            target = s.install(**self.kwargs)
        original = target.read_bytes(); self.loaded = True
        with patch.object(s, 'run', side_effect=self.fake_run), patch.object(s, 'drain_lock', side_effect=RuntimeError('holds the lock')):
            with self.assertRaisesRegex(RuntimeError, 'holds the lock'):
                s.install(**self.kwargs)
        self.assertEqual(target.read_bytes(), original)
        self.assertEqual(sum(a[:2] == ['/bin/launchctl', 'bootout'] for a in self.calls), 1)
        self.assertEqual(sum(a[:2] == ['/bin/launchctl', 'bootstrap'] for a in self.calls), 2)

    def test_state_parent_alias_and_launchd_canonical_path_are_accepted(self):
        actual = self.root / 'actual'
        actual.mkdir()
        alias = self.root / 'alias'
        alias.symlink_to(actual, target_is_directory=True)
        self.state = actual / 'state'
        self.agents = actual / 'agents'
        self.kwargs['state'] = str(alias / 'state')
        self.kwargs['agents'] = str(alias / 'agents')
        with patch.object(s, 'run', side_effect=self.fake_run):
            target = s.install(**self.kwargs)
            self.assertEqual(s.owned_plist(target, self.state), target.read_bytes())
            self.loaded = True
            s.install(**self.kwargs)
        self.assertTrue(any(a[:2] == ['/bin/launchctl', 'bootout'] for a in self.calls))

    def test_state_or_plist_leaf_symlinks_remain_rejected(self):
        with patch.object(s, 'run', side_effect=self.fake_run):
            target = s.install(**self.kwargs)
        state_link = self.root / 'state-link'
        state_link.symlink_to(self.state, target_is_directory=True)
        with self.assertRaisesRegex(RuntimeError, 'unowned'):
            s.owned_plist(target, state_link)
        plist_link = self.root / 'plist-link'
        plist_link.symlink_to(target)
        self.assertFalse(s.launchd_uses_plist(f'path = {plist_link}\n'.encode(), target))

    def test_loaded_job_without_owned_plist_is_never_booted_out(self):
        self.loaded = True
        with patch.object(s, 'run', side_effect=self.fake_run), self.assertRaisesRegex(RuntimeError, 'not verified'):
            s.install(**self.kwargs)
        self.assertFalse(any(a[:2] == ['/bin/launchctl', 'bootout'] for a in self.calls))


if __name__ == '__main__': unittest.main()
