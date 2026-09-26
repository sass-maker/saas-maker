import base64
from pathlib import Path
import tempfile
import unittest

from shared.appcast_core import (
    checksum_from_sums,
    one_release_dmg,
    sha256_file,
    stage_dmg,
    validate_signed_feed,
)


class AppcastCoreTests(unittest.TestCase):
    def test_stages_exact_dmg_and_accepts_its_signed_enclosure(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "App-1.0-2-universal.dmg"
            source.write_bytes(b"qualified-dmg")
            digest = sha256_file(source)
            (root / "SHA256SUMS").write_text(f"{digest}  {source.name}\n")
            self.assertEqual(one_release_dmg(root), source)
            self.assertEqual(checksum_from_sums(source, root / "SHA256SUMS"), digest)

            filename = "app-1.0-build2-universal.dmg"
            copied = stage_dmg(source, root / "feed", filename, digest)
            self.assertEqual(copied.read_bytes(), source.read_bytes())
            url = f"https://app.example/updates/{filename}"
            signature = base64.b64encode(bytes(64)).decode()
            feed = root / "feed/appcast.xml"
            feed.write_text(
                '<rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">'
                f'<channel><item><enclosure url="{url}" length="{copied.stat().st_size}" '
                f'sparkle:edSignature="{signature}"/></item></channel></rss>'
            )
            validate_signed_feed(feed, url, copied.stat().st_size)

            with self.assertRaisesRegex(ValueError, "enclosure does not match"):
                validate_signed_feed(feed, "https://other.example/updates/app.dmg", copied.stat().st_size)
            with self.assertRaisesRegex(ValueError, "enclosure does not match"):
                validate_signed_feed(feed, url, copied.stat().st_size + 1)

    def test_rejects_missing_duplicate_or_changed_release_artifacts(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaisesRegex(ValueError, "exactly one release DMG"):
                one_release_dmg(root)
            source = root / "one.dmg"
            source.write_bytes(b"one")
            other = root / "two.dmg"
            other.write_bytes(b"two")
            with self.assertRaisesRegex(ValueError, "exactly one release DMG"):
                one_release_dmg(root)
            digest = sha256_file(source)
            sums = root / "SHA256SUMS"
            sums.write_text(f"{digest}  {source.name}\n{digest}  {source.name}\n")
            with self.assertRaisesRegex(ValueError, "exactly one matching DMG"):
                checksum_from_sums(source, sums)
            sums.write_text(f"{digest}  {source.name}\n")
            source.write_bytes(b"changed")
            with self.assertRaisesRegex(ValueError, "Release checksum mismatch"):
                checksum_from_sums(source, sums)
            with self.assertRaisesRegex(ValueError, "Release checksum mismatch"):
                stage_dmg(source, root / "feed", "one.dmg", digest)
            self.assertFalse((root / "feed").exists())
            with self.assertRaisesRegex(ValueError, "Unsafe update DMG filename"):
                stage_dmg(source, root / "feed", "../one.dmg", sha256_file(source))

    def test_rejects_unsigned_invalid_or_multiple_enclosures(self):
        with tempfile.TemporaryDirectory() as directory:
            feed = Path(directory) / "appcast.xml"
            url = "https://app.example/updates/app.dmg"
            enclosure = f'<enclosure url="{url}" length="3"/>'
            feed.write_text(f"<rss><channel><item>{enclosure}</item></channel></rss>")
            with self.assertRaisesRegex(ValueError, "Unsigned or invalid"):
                validate_signed_feed(feed, url, 3)
            feed.write_text(f"<rss><channel><item>{enclosure}{enclosure}</item></channel></rss>")
            with self.assertRaisesRegex(ValueError, "exactly one update enclosure"):
                validate_signed_feed(feed, url, 3)


if __name__ == "__main__":
    unittest.main()
