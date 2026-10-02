"""Apply review patches in fixtures and run wrappers without keys or Apple tools."""

import base64
import hashlib
import json
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock, patch


PATCHES = Path(__file__).resolve().parents[1] / "app-wrapper-patches"
APPS = ("storagedaddy", "performancedaddy", "browserdaddy")


class AppcastWrapperTests(unittest.TestCase):
    def run_wrapper(self, app, failure=None):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            scripts = root / "scripts"
            scripts.mkdir()
            wrapper = scripts / "prepare-appcast.py"
            # Full-context diffs preserve the inspected source as a portable fixture.
            diff = (PATCHES / f"{app}.patch").read_text()
            hunk = diff.split('\n@@', 1)[1].split('\n', 1)[1]
            wrapper.write_text(''.join(line[1:] for line in hunk.splitlines(True)
                                       if line.startswith((' ', '-'))))
            subprocess.run(['git', 'apply', '--check', str(PATCHES / f"{app}.patch")],
                           cwd=root, check=True, capture_output=True)
            subprocess.run(['git', 'apply', str(PATCHES / f"{app}.patch")],
                           cwd=root, check=True, capture_output=True)
            release = root / "release"
            release.mkdir()
            output = root / "output"
            product = {'storagedaddy': 'StorageDaddy', 'performancedaddy': 'PerformanceDaddy',
                       'browserdaddy': 'BrowserDaddy'}[app]
            source = release / f"{product}-1.2.3-4-universal.dmg"
            if failure != 'missing-dmg':
                source.write_bytes(b"qualified fixture")
            digest = hashlib.sha256(b"qualified fixture").hexdigest()
            if failure == 'checksum':
                digest = '0' * 64
            receipt = dict(version='1.2.3', build=4, dmgSha256=digest,
                           signed=True, notarized=True, stapled=True)
            if failure == 'qualification':
                receipt['signed'] = False
            (release / 'release-receipt.json').write_text(json.dumps(receipt))
            if failure != 'missing-checksum':
                (release / 'SHA256SUMS').write_text(f'{digest}  {source.name}\n')
            if failure == 'multiple-dmg':
                (release / 'other.dmg').write_bytes(b"other")
            if failure == 'name' and app != 'storagedaddy':
                source.rename(release / 'wrong.dmg')
            support = types.ModuleType('sparkle_support')
            support.ROOT = root
            support.configuration = Mock()
            calls = []

            def run(command, **kwargs):
                calls.append(command)
                if command[0] in ('codesign', 'xcrun'):
                    if failure == 'qualification':
                        raise subprocess.CalledProcessError(1, command)
                    return
                self.assertEqual(Path(command[0]).name, 'generate_appcast')
                self.assertEqual(command[1:3], ['--account', f'{app}-updates'])
                self.assertIsNone(kwargs['input'])
                self.assertTrue(kwargs['check'])
                staged = next(output.glob('*.dmg'))
                self.assertEqual(staged.read_bytes(), b"qualified fixture")
                url = command[4] + staged.name
                length = str(staged.stat().st_size)
                signature = base64.b64encode(bytes(64)).decode()
                if failure == 'url':
                    url += '?wrong'
                if failure == 'length':
                    length = '1'
                if failure == 'unsigned':
                    signature = ''
                if failure == 'signature':
                    signature = 'malformed'
                enclosure = (f'<enclosure url="{url}" length="{length}" '
                             f'sparkle:edSignature="{signature}"/>')
                if failure == 'empty-feed':
                    enclosure = ''
                if failure == 'multiple-feed':
                    enclosure *= 2
                xml = ('<rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">'
                       f'<channel><item>{enclosure}</item></channel></rss>')
                if failure == 'malformed-feed':
                    xml = '<rss>'
                if failure == 'staged-drift':
                    staged.write_bytes(b"changed")
                (output / 'appcast.xml').write_text(xml)

            with patch.dict(sys.modules, sparkle_support=support), \
                 patch.object(sys, 'path', [str(Path(__file__).parent), *sys.path]), \
                 patch.object(sys, 'argv', [str(wrapper), str(release), str(output)]), \
                 patch('os.environ', {}), patch('subprocess.run', side_effect=run), \
                 patch('builtins.print'):
                if failure:
                    with self.assertRaises((ValueError, SystemExit, subprocess.CalledProcessError)):
                        runpy.run_path(str(wrapper), run_name='__main__')
                else:
                    runpy.run_path(str(wrapper), run_name='__main__')
                    self.assertEqual(len(calls), 1 if app == 'storagedaddy' else 3)
                support.configuration.assert_called_once_with()

    def test_valid_wrappers_preserve_app_owned_qualification_and_signing(self):
        for app in APPS:
            with self.subTest(app=app):
                self.run_wrapper(app)

    def test_wrappers_reject_invalid_artifacts_and_feeds(self):
        for app in APPS:
            for failure in ('missing-dmg', 'multiple-dmg', 'checksum', 'qualification',
                            'url', 'length', 'unsigned', 'signature', 'empty-feed',
                            'multiple-feed', 'malformed-feed', 'staged-drift'):
                with self.subTest(app=app, failure=failure):
                    self.run_wrapper(app, failure)
            if app != 'storagedaddy':
                for failure in ('missing-checksum', 'name'):
                    with self.subTest(app=app, failure=failure):
                        self.run_wrapper(app, failure)


if __name__ == '__main__':
    unittest.main()
