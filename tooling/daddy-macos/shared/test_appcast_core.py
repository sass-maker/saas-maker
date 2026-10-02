import base64
import hashlib
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from appcast_core import (checksum_from_file, select_dmg, stage_dmg,
                          validate_appcast, validate_checksum)


class AppcastCoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.release = self.root / "release"
        self.release.mkdir()
        self.source = self.release / "app.dmg"
        self.source.write_bytes(b"post-staple bytes")
        self.digest = hashlib.sha256(self.source.read_bytes()).hexdigest()
        self.feed = self.root / "appcast.xml"
        self.url = "https://example.test/updates/app.dmg"

    def write_feed(self, **overrides):
        values = dict(url=self.url, length=str(self.source.stat().st_size),
                      signature=base64.b64encode(bytes(64)).decode())
        values.update(overrides)
        enclosure = (f'<enclosure url="{values["url"]}" length="{values["length"]}" '
                     f'sparkle:edSignature="{values["signature"]}"/>')
        self.feed.write_text('<rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">'
                             f'<channel><item>{enclosure}</item></channel></rss>')

    def test_single_dmg_and_missing_multiple_nonfile_fail(self):
        self.assertEqual(select_dmg(self.release), self.source)
        (self.release / "second.dmg").write_bytes(b"other")
        with self.assertRaisesRegex(ValueError, "exactly one"):
            select_dmg(self.release)
        empty = self.root / "empty"
        empty.mkdir()
        with self.assertRaises(ValueError):
            select_dmg(empty)
        (empty / "directory.dmg").mkdir()
        with self.assertRaises(ValueError):
            select_dmg(empty)

    def test_checksum_rows_fail_closed(self):
        sums = self.release / "SHA256SUMS"
        with self.assertRaisesRegex(ValueError, "Missing"):
            checksum_from_file(sums, self.source.name)
        for row in (f'{self.digest}  app.dmg\n', f'{self.digest.upper()} *app.dmg\n'):
            sums.write_text(row)
            self.assertEqual(checksum_from_file(sums, self.source.name), self.digest)
        for content in ('garbage', 'z' * 64 + '  app.dmg',
                        f'{self.digest}  other.dmg',
                        f'{self.digest}  app.dmg\n{self.digest}  app.dmg\n'):
            with self.subTest(content=content):
                sums.write_text(content)
                with self.assertRaises(ValueError):
                    checksum_from_file(sums, self.source.name)

    def test_checksum_drift_and_malformed_digest_fail_before_staging(self):
        for expected in (None, 'garbage', '0' * 64):
            with self.subTest(expected=expected), self.assertRaises(ValueError):
                stage_dmg(self.source, self.root / "output", "app.dmg", expected)
        self.assertFalse((self.root / "output").exists())
        self.source.write_bytes(b"changed")
        with self.assertRaisesRegex(ValueError, "checksum mismatch"):
            validate_checksum(self.source, self.digest)

    def test_staging_byte_identity_and_new_directory(self):
        output = self.root / "output"
        staged = stage_dmg(self.source, output, "app.dmg", self.digest)
        self.assertEqual(staged.read_bytes(), self.source.read_bytes())
        with self.assertRaises(FileExistsError):
            stage_dmg(self.source, output, "app.dmg", self.digest)
        with self.assertRaises(ValueError):
            stage_dmg(self.source, self.root / "unsafe", "../app.dmg", self.digest)

    def test_corrupted_copy_is_rejected(self):
        def corrupt(source, target):
            target.write_bytes(b"corrupt")
        with patch('appcast_core.shutil.copy2', side_effect=corrupt):
            with self.assertRaisesRegex(ValueError, "checksum mismatch"):
                stage_dmg(self.source, self.root / "output", "app.dmg", self.digest)

    def test_valid_feed_and_mismatches_unsigned_malformed_fail(self):
        self.write_feed()
        validate_appcast(self.feed, self.source, self.url, self.digest)
        for changes in (dict(url=self.url + '?other'), dict(length='1'),
                        dict(length='016'), dict(signature=''), dict(signature='unsigned'),
                        dict(signature=base64.b64encode(bytes(63)).decode())):
            with self.subTest(changes=changes):
                self.write_feed(**changes)
                with self.assertRaises(ValueError):
                    validate_appcast(self.feed, self.source, self.url, self.digest)
        for xml in ('<rss>', '<rss><channel/></rss>',
                    '<rss><channel><item><enclosure/><enclosure/></item></channel></rss>'):
            self.feed.write_text(xml)
            with self.assertRaises(ValueError):
                validate_appcast(self.feed, self.source, self.url, self.digest)
        missing = self.root / "missing.xml"
        with self.assertRaises(ValueError):
            validate_appcast(missing, self.source, self.url, self.digest)
        self.write_feed()
        self.source.write_bytes(b"changed after signing")
        with self.assertRaisesRegex(ValueError, "checksum mismatch"):
            validate_appcast(self.feed, self.source, self.url, self.digest)


if __name__ == "__main__":
    unittest.main()
