import json
from pathlib import Path
import tempfile
import unittest

from candidate import check_shared_copies, profile_for


class DaddyCandidateProfilesTests(unittest.TestCase):
    def test_all_four_profiles_bind_to_their_own_repository(self):
        for app in ("storagedaddy", "performancedaddy", "browserdaddy", "contextdaddy"):
            with self.subTest(app=app):
                profile = profile_for(app, f"sarthakagrawal927/{app}")
                self.assertEqual(profile["repository"], f"sarthakagrawal927/{app}")

    def test_wrong_repository_and_unknown_app_fail_closed(self):
        with self.assertRaisesRegex(ValueError, "Wrong repository"):
            profile_for("browserdaddy", "sarthakagrawal927/performancedaddy")
        with self.assertRaisesRegex(ValueError, "Unknown Daddy app"):
            profile_for("anotherdaddy", "sarthakagrawal927/anotherdaddy")

    def test_unknown_manifest_field_fails_closed(self):
        source = json.loads(Path(__file__).with_name("profiles.json").read_text())
        source["apps"]["storagedaddy"]["shell"] = "echo bypass"
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "profiles.json"
            path.write_text(json.dumps(source))
            with self.assertRaisesRegex(ValueError, "Unexpected profile fields"):
                profile_for("storagedaddy", "sarthakagrawal927/storagedaddy", path)

    def test_shared_copies_reject_missing_and_changed_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shared = root / "shared"
            (root / "site").mkdir()
            (root / "scripts").mkdir()
            shared.mkdir()
            (shared / "worker-core.mjs").write_text("original")
            (shared / "sparkle_core.py").write_text("sparkle")
            (root / "scripts/sparkle_core.py").write_text("sparkle")
            with self.assertRaisesRegex(ValueError, "Missing shared Daddy utility"):
                check_shared_copies("browserdaddy", root, shared)
            (root / "site/worker-core.mjs").write_text("changed")
            with self.assertRaisesRegex(ValueError, "Shared Daddy utility drift"):
                check_shared_copies("browserdaddy", root, shared)
            (root / "site/worker-core.mjs").write_text("original")
            check_shared_copies("browserdaddy", root, shared)


if __name__ == "__main__":
    unittest.main()
