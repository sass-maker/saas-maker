#!/usr/bin/env python3
"""Stage an exact watcher revision and install its owned user launch agent."""
import argparse
import fcntl
import os
import pathlib
import plistlib
import re
import stat
import subprocess
import tempfile
import time
import uuid

LABEL = 'com.sarthak.fleet-product-assets'
FILES = (
    'tooling/launchkit/scripts/asset-watch.mjs',
    'tooling/launchkit/scripts/asset-watch-supervisor.py',
    'tooling/launchkit/scripts/asset-apply.mjs',
    'tooling/launchkit/scripts/asset-verify.mjs',
    'tooling/lib/agent-workspaces.mjs',
    'tooling/lib/disk-scan-coordination.mjs',
    'tooling/lib/disk-scan-worker.mjs',
)
PATH = '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'


def run(argv, **kwargs):
    return subprocess.run(argv, check=False, capture_output=True, **kwargs)


def command(argv, **kwargs):
    p = run(argv, **kwargs)
    if p.returncode:
        # stderr may contain private paths or tool output; do not expose it.
        raise RuntimeError(f'Command failed: {argv[0]}')
    return p.stdout


def private_dir(path):
    path = pathlib.Path(path)
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    st = path.lstat()
    if not stat.S_ISDIR(st.st_mode) or stat.S_ISLNK(st.st_mode):
        raise RuntimeError(f'Unsafe directory: {path}')
    os.chmod(path, 0o700)
    return path


def regular(path):
    try:
        st = pathlib.Path(path).lstat()
        return stat.S_ISREG(st.st_mode) and not stat.S_ISLNK(st.st_mode)
    except FileNotFoundError:
        return False


def source_bytes(repo, sha):
    if not re.fullmatch(r'[0-9a-f]{40}', sha):
        raise ValueError('Expected an exact 40-character lowercase commit SHA')
    actual = command(['git', '-C', str(repo), 'rev-parse', '--verify', sha + '^{commit}']).decode().strip()
    if actual != sha:
        raise ValueError('Commit SHA does not resolve exactly')
    result = {}
    for name in FILES:
        tree = command(['git', '-C', str(repo), 'ls-tree', sha, '--', name]).decode().strip()
        if not re.fullmatch(r'100(?:644|755) blob [0-9a-f]+\t' + re.escape(name), tree):
            raise ValueError(f'Missing or unsafe committed source: {name}')
        result[name] = command(['git', '-C', str(repo), 'show', f'{sha}:{name}'])
    return result


def verify_release(root, files):
    root = pathlib.Path(root)
    if root.is_symlink() or not root.is_dir():
        raise RuntimeError('Release path is not a regular directory')
    found = set()
    for parent, dirs, names in os.walk(root, followlinks=False):
        for dirname in dirs:
            if (pathlib.Path(parent) / dirname).is_symlink():
                raise RuntimeError('Release contains a symlink')
        for name in names:
            found.add((pathlib.Path(parent) / name).relative_to(root).as_posix())
    if found != set(files):
        raise RuntimeError('Release has missing or unexpected files')
    for name, expected in files.items():
        target = root / name
        for parent in [target.parent, *target.parents]:
            if parent == root.parent:
                break
            if parent.is_symlink():
                raise RuntimeError('Release contains a symlink')
        if not regular(target) or target.read_bytes() != expected:
            raise RuntimeError(f'Release bytes do not match committed source: {name}')


def stage_release(state, sha, files):
    releases = private_dir(state / 'releases')
    final = releases / sha
    if final.exists() or final.is_symlink():
        verify_release(final, files)
        return final
    stage = releases / ('.stage-' + uuid.uuid4().hex)
    stage.mkdir(mode=0o700)
    for name, data in files.items():
        dest = stage / name
        dest.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        with dest.open('xb') as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(dest, 0o400)
    verify_release(stage, files)
    for parent, dirs, _ in os.walk(stage, topdown=False):
        for dirname in dirs:
            os.chmod(pathlib.Path(parent) / dirname, 0o500)
    os.chmod(stage, 0o500)
    os.rename(stage, final)
    verify_release(final, files)
    return final


def make_plist(release, state, fleet, index, node, codex, python):
    paths = (release, state, fleet, index, node, codex, python)
    if not all(pathlib.Path(x).is_absolute() for x in paths):
        raise ValueError('All runtime paths must be absolute')
    scripts = pathlib.Path(release) / 'tooling/launchkit/scripts'
    return {
        'Label': LABEL,
        'ProgramArguments': [str(python), str(scripts / 'asset-watch-supervisor.py'), str(state), str(node), str(scripts / 'asset-watch.mjs')],
        'EnvironmentVariables': {'PATH': PATH, 'FLEET_ROOT': str(fleet), 'FLEET_ASSET_INDEX': str(index), 'FLEET_ASSET_WATCH_STATE': str(state), 'FLEET_CODEX': str(codex)},
        'RunAtLoad': True, 'KeepAlive': True, 'ThrottleInterval': 60,
        'ProcessType': 'Background',
        'StandardOutPath': str(pathlib.Path(state) / 'logs/stdout.log'),
        'StandardErrorPath': str(pathlib.Path(state) / 'logs/stderr.log'),
    }


def owned_plist(path, state):
    if not pathlib.Path(path).exists() and not pathlib.Path(path).is_symlink():
        return None
    if not regular(path):
        raise RuntimeError('An unowned or unsafe item occupies the plist path')
    raw = pathlib.Path(path).read_bytes()
    try:
        data = plistlib.loads(raw)
        args = data['ProgramArguments']
        requested_state = pathlib.Path(state)
        written_state = pathlib.Path(args[2])
        if requested_state.is_symlink() or written_state.is_symlink():
            raise ValueError('state directory is a symlink')
        if not requested_state.is_absolute() or not written_state.is_absolute():
            raise ValueError('state directory is not absolute')
        if requested_state.resolve(strict=True) != written_state.resolve(strict=True):
            raise ValueError('state directory mismatch')
        release_root = written_state / 'releases'
        supervisor = pathlib.Path(args[1])
        watcher = pathlib.Path(args[4])
        rel = supervisor.relative_to(release_root)
        if (data['Label'] != LABEL or len(args) != 5 or len(rel.parts) != 5
                or not re.fullmatch(r'[0-9a-f]{40}', rel.parts[0])
                or rel.parts[1:] != ('tooling', 'launchkit', 'scripts', 'asset-watch-supervisor.py')
                or watcher != release_root / rel.parts[0] / 'tooling/launchkit/scripts/asset-watch.mjs'
                ):
            raise ValueError('not owned')
    except (ValueError, KeyError, TypeError, IndexError, OSError, plistlib.InvalidFileException):
        raise RuntimeError('An unowned plist occupies the service label path') from None
    return raw


def launchd_uses_plist(output, expected):
    """Allow /tmp and /private/tmp aliases but reject leaf symlinks and missing files."""
    lines = output.decode('utf8', errors='replace').splitlines()
    paths = [line.strip()[7:] for line in lines if line.strip().startswith('path = ')]
    if len(paths) != 1 or not regular(expected) or not regular(paths[0]):
        return False
    try:
        return os.path.samefile(paths[0], expected)
    except OSError:
        return False


def locked_file(path):
    fd = os.open(path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    if not stat.S_ISREG(os.fstat(fd).st_mode):
        os.close(fd)
        raise RuntimeError('Unsafe lock path')
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        os.close(fd)
        raise RuntimeError('Active watcher or installation holds the lock') from None
    return fd


def drain_lock(path, seconds=30):
    deadline = time.monotonic() + seconds
    while True:
        try:
            return locked_file(path)
        except RuntimeError as error:
            if 'holds the lock' not in str(error) or time.monotonic() >= deadline:
                raise
            time.sleep(0.1)


def atomic_file(path, data):
    path = pathlib.Path(path)
    fd, name = tempfile.mkstemp(prefix='.asset-service-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(name, 0o600)
        os.replace(name, path)
    except BaseException:
        # Keep an interrupted temp file for inspection instead of deleting data.
        raise


def plan(repo, sha, state, fleet, index, node, codex, python):
    files = source_bytes(repo, sha)
    release = pathlib.Path(state) / 'releases' / sha
    p = make_plist(release, state, fleet, index, node, codex, python)
    return files, p


def install(*, repo, sha, state, fleet, index, node, codex, python, agents, uid):
    state, agents = pathlib.Path(state), pathlib.Path(agents)
    files, planned = plan(repo, sha, state, fleet, index, node, codex, python)
    if not regular(index) or not pathlib.Path(fleet).is_dir():
        raise RuntimeError('Drive index or Fleet root is unavailable')
    if not all(os.path.isfile(p) and os.access(p, os.X_OK) for p in (node, codex, python)):
        raise RuntimeError('A required executable is unavailable')
    private_dir(state)
    agents.mkdir(parents=True, exist_ok=True)
    if agents.is_symlink() or not agents.is_dir():
        raise RuntimeError('Unsafe LaunchAgents directory')
    plist = agents / (LABEL + '.plist')
    install_lock = locked_file(state / 'install.lock')
    watcher_lock = None
    try:
        previous = owned_plist(plist, state)
        stage_release(state, sha, files)
        logs = private_dir(state / 'logs')
        for name in ('stdout.log', 'stderr.log'):
            path = logs / name
            fd = os.open(path, os.O_CREAT | os.O_APPEND | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
            if not stat.S_ISREG(os.fstat(fd).st_mode):
                os.close(fd); raise RuntimeError('Unsafe log path')
            os.fchmod(fd, 0o600); os.close(fd)
        candidate = state / ('candidate-' + uuid.uuid4().hex + '.plist')
        atomic_file(candidate, plistlib.dumps(planned))
        command(['/usr/bin/plutil', '-lint', str(candidate)])
        domain = f'gui/{uid}'
        current = run(['/bin/launchctl', 'print', domain + '/' + LABEL])
        was_loaded = current.returncode == 0
        if was_loaded:
            if not previous or not launchd_uses_plist(current.stdout, plist):
                raise RuntimeError('The loaded service is not verified as this owned plist')
        if previous:
            atomic_file(state / 'previous.plist', previous)
        if was_loaded:
            command(['/bin/launchctl', 'bootout', domain + '/' + LABEL])
        try:
            watcher_lock = drain_lock(state / 'watch.lock') if was_loaded else locked_file(state / 'watch.lock')
        except BaseException:
            if was_loaded:
                command(['/bin/launchctl', 'bootstrap', domain, str(plist)])
            raise
        try:
            atomic_file(plist, plistlib.dumps(planned))
            os.close(watcher_lock); watcher_lock = None
            command(['/bin/launchctl', 'bootstrap', domain, str(plist)])
        except BaseException:
            # Preserve failed candidate. Restore only a plist we verified as ours.
            if previous:
                atomic_file(plist, previous)
                if was_loaded:
                    command(['/bin/launchctl', 'bootstrap', domain, str(plist)])
            elif plist.exists():
                os.rename(plist, state / ('failed-' + uuid.uuid4().hex + '.plist'))
            raise
        return plist
    finally:
        if watcher_lock is not None: os.close(watcher_lock)
        os.close(install_lock)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('action', choices=['plan', 'install', 'status'])
    p.add_argument('--repo'); p.add_argument('--sha'); p.add_argument('--index'); p.add_argument('--fleet')
    p.add_argument('--state', default=str(pathlib.Path.home() / 'Library/Application Support/Fleet/Product Asset Watch'))
    p.add_argument('--agents', default=str(pathlib.Path.home() / 'Library/LaunchAgents'))
    p.add_argument('--node', default='/opt/homebrew/bin/node')
    p.add_argument('--python', default='/usr/bin/python3')
    p.add_argument('--codex', default=str(pathlib.Path.home() / '.local/bin/codex'))
    p.add_argument('--uid', default=os.getuid(), type=int)
    a = p.parse_args()
    try:
        if a.action == 'status':
            path = pathlib.Path(a.agents) / (LABEL + '.plist')
            owned = owned_plist(path, a.state)
            current = run(['/bin/launchctl', 'print', f'gui/{a.uid}/{LABEL}'])
            loaded = current.returncode == 0
            if loaded and (not owned or not launchd_uses_plist(current.stdout, path)):
                raise RuntimeError('Loaded service does not match the owned plist')
            print('owned:', bool(owned), 'loaded:', loaded)
            return
        if not all((a.repo, a.sha, a.index, a.fleet)):
            raise ValueError('--repo, --sha, --index and --fleet are required')
        kwargs = dict(repo=a.repo, sha=a.sha, state=a.state, fleet=a.fleet, index=a.index, node=a.node, codex=a.codex, python=a.python)
        if a.action == 'plan':
            files, plist = plan(**kwargs)
            print('sha:', a.sha, 'files:', len(files), 'total bytes:', sum(map(len, files.values())))
            print(plistlib.dumps(plist).decode())
        else:
            print('installed:', install(**kwargs, agents=a.agents, uid=a.uid))
    except (ValueError, RuntimeError, OSError) as error:
        p.exit(1, f'asset service: {error}\n')


if __name__ == '__main__': main()
