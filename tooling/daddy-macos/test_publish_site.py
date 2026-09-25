import base64
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from candidate import profile_for
from publish_site import LAYOUT, expected_filename, stage
from verify_live import verify


class PublishSiteTests(unittest.TestCase):
    def fixture(self, root: Path, app: str):
        repository = f"sarthakagrawal927/{app}"
        profile = profile_for(app, repository)
        site = root / "site"
        site.mkdir()
        (site / "release.json").write_text(json.dumps({"build": 1, "sha256": "0" * 64}))
        dmg = root / expected_filename(app, "0.2.0", 2)
        dmg.write_bytes(b"qualified-dmg")
        digest = hashlib.sha256(dmg.read_bytes()).hexdigest()
        receipt = root / "receipt.json"
        receipt.write_text(json.dumps({
            "state": "release-metadata-validated", "app": app,
            "repository": repository, "version": "0.2.0", "build": 2,
            "sourceSha": "a" * 40, "dmgSha256": digest,
            "updateMode": profile["updateMode"],
        }))
        feed = None
        if profile["updateMode"] == "sparkle":
            feed = root / "appcast.xml"
            signature = base64.b64encode(b"x" * 64).decode()
            feed.write_text(
                '<rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">'
                '<channel><item><sparkle:version>2</sparkle:version>'
                '<sparkle:shortVersionString>0.2.0</sparkle:shortVersionString>'
                f'<enclosure url="{profile["updateBaseUrl"]}{dmg.name}" length="{dmg.stat().st_size}" '
                f'sparkle:edSignature="{signature}"/></item></channel></rss>'
            )
        sums = None
        if app == "storagedaddy":
            sums = root / "SHA256SUMS"
            sums.write_text(f"{digest}  {dmg.name}\n")
        return repository, site, dmg, receipt, feed, sums

    def test_stage_all_four_layouts_and_verify_live_bytes(self):
        for app, layout in LAYOUT.items():
            with self.subTest(app=app), tempfile.TemporaryDirectory() as directory:
                repository, site, dmg, receipt, feed, sums = self.fixture(Path(directory), app)
                report = stage(app, repository, site, dmg, receipt, feed, sums)
                self.assertEqual(json.loads((site / "release.json").read_text())["build"], 2)
                for path in layout["dmg_dirs"]:
                    self.assertEqual((site / "public" / path / dmg.name).read_bytes(), dmg.read_bytes())
                if feed:
                    self.assertEqual((site / "public" / layout["feed"]).read_bytes(), feed.read_bytes())
                with patch("verify_live.remote_sha256") as remote:
                    remote.side_effect = lambda url: (
                        hashlib.sha256(feed.read_bytes()).hexdigest() if url == report["feedUrl"] else report["dmgSha256"],
                        feed.stat().st_size if url == report["feedUrl"] else dmg.stat().st_size,
                    )
                    self.assertEqual(verify(report, dmg, feed)["state"], "live-publication-verified")
                    self.assertEqual(remote.call_count, 3 if feed else 1)

    def test_rejects_changed_artifact_and_same_build_replacement(self):
        with tempfile.TemporaryDirectory() as directory:
            repository, site, dmg, receipt, feed, sums = self.fixture(Path(directory), "browserdaddy")
            dmg.write_bytes(b"changed")
            with self.assertRaisesRegex(ValueError, "does not match qualified"):
                stage("browserdaddy", repository, site, dmg, receipt, feed, sums)
            dmg.write_bytes(b"qualified-dmg")
            alias = dmg.with_name("live-download.dmg")
            alias.write_bytes(dmg.read_bytes())
            with self.assertRaisesRegex(ValueError, "does not match qualified"):
                stage("browserdaddy", repository, site, alias, receipt, feed, sums)
            (site / "release.json").write_text(json.dumps({"build": 2, "sha256": "0" * 64}))
            with self.assertRaisesRegex(ValueError, "different published build"):
                stage("browserdaddy", repository, site, dmg, receipt, feed, sums)

    def test_rejects_wrong_caller_and_missing_feed(self):
        with tempfile.TemporaryDirectory() as directory:
            repository, site, dmg, receipt, feed, sums = self.fixture(Path(directory), "performancedaddy")
            with self.assertRaisesRegex(ValueError, "Wrong repository"):
                stage("performancedaddy", "sarthakagrawal927/browserdaddy", site, dmg, receipt, feed, sums)
            with self.assertRaisesRegex(ValueError, "requires its qualified feed"):
                stage("performancedaddy", repository, site, dmg, receipt)


if __name__ == "__main__":
    unittest.main()
