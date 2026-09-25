import base64
from pathlib import Path
import tempfile
import unittest

from candidate import profile_for
from release_contract import validate_appcast, validate_checksum, validate_notarization, validate_version


class DaddyReleaseContractTests(unittest.TestCase):
    def setUp(self):
        self.profile = profile_for("performancedaddy", "sarthakagrawal927/performancedaddy")
        self.info = {
            "CFBundleIdentifier": self.profile["bundleId"],
            "CFBundleExecutable": self.profile["executable"],
            "CFBundleShortVersionString": "0.2.4",
            "CFBundleVersion": "4",
        }

    def test_tag_matches_bundle_and_new_build(self):
        self.assertEqual(validate_version("v0.2.4-4", self.info, self.profile, 3), ("0.2.4", 4))
        with self.assertRaisesRegex(ValueError, "exceed"):
            validate_version("v0.2.4-4", self.info, self.profile, 4)
        with self.assertRaisesRegex(ValueError, "Info.plist"):
            validate_version("v0.2.5-4", self.info, self.profile, 3)
        with self.assertRaisesRegex(ValueError, "Release tag"):
            validate_version("v00.2.4-4", self.info, self.profile, 3)
        with self.assertRaisesRegex(ValueError, "identifier"):
            validate_version("v0.2.4-4", {**self.info, "CFBundleIdentifier": "wrong"}, self.profile, 3)

    def test_notary_acceptance_requires_submission_identity(self):
        self.assertEqual(validate_notarization({"id": "submission", "status": "Accepted"}), "submission")
        with self.assertRaisesRegex(ValueError, "Notarization"):
            validate_notarization({"status": "Accepted"})
        with self.assertRaisesRegex(ValueError, "Notarization"):
            validate_notarization({"id": "submission", "status": "Invalid"})

    def test_checksum_binds_exact_post_staple_dmg(self):
        with tempfile.TemporaryDirectory() as directory:
            dmg = Path(directory) / "app.dmg"
            sums = Path(directory) / "SHA256SUMS"
            dmg.write_bytes(b"qualified")
            sums.write_text("2a6d52f3e8813e02503271369587c57d30ff4edb81d894b1e01725b1e5b36c1f  app.dmg\n")
            with self.assertRaisesRegex(ValueError, "checksum mismatch"):
                validate_checksum(dmg, sums)
            import hashlib
            sums.write_text(f"{hashlib.sha256(dmg.read_bytes()).hexdigest()}  app.dmg\n")
            self.assertEqual(validate_checksum(dmg, sums), hashlib.sha256(b"qualified").hexdigest())
            dmg.write_bytes(b"changed")
            with self.assertRaisesRegex(ValueError, "checksum mismatch"):
                validate_checksum(dmg, sums)

    def test_appcast_requires_exact_artifact_and_signature(self):
        with tempfile.TemporaryDirectory() as directory:
            dmg = Path(directory) / "performancedaddy-0.2.4-build4-universal.dmg"
            feed = Path(directory) / "appcast.xml"
            dmg.write_bytes(b"qualified")
            signature = base64.b64encode(bytes(64)).decode()
            def xml(url, ed_signature=signature):
                return ("<rss xmlns:sparkle=\"http://www.andymatuschak.org/xml-namespaces/sparkle\"><channel><item>"
                        f"<sparkle:version>4</sparkle:version><sparkle:shortVersionString>0.2.4</sparkle:shortVersionString>"
                        f"<enclosure url=\"{url}\" length=\"9\" sparkle:edSignature=\"{ed_signature}\"/>"
                        "</item></channel></rss>")
            correct_url = self.profile["updateBaseUrl"] + dmg.name
            feed.write_text(xml(correct_url))
            validate_appcast(feed, dmg, "0.2.4", 4, self.profile["updateBaseUrl"])
            feed.write_text(xml(correct_url.replace("performance.daddyrad.com", "other.example")))
            with self.assertRaisesRegex(ValueError, "URL"):
                validate_appcast(feed, dmg, "0.2.4", 4, self.profile["updateBaseUrl"])
            feed.write_text(xml(correct_url, "unsigned"))
            with self.assertRaisesRegex(ValueError, "signature"):
                validate_appcast(feed, dmg, "0.2.4", 4, self.profile["updateBaseUrl"])


if __name__ == "__main__":
    unittest.main()
