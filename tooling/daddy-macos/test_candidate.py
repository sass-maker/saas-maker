import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from candidate import SHARED_COPIES, check_shared_copies, profile_for
from check_copies import main as check_copies_main


class DaddyCandidateProfilesTests(unittest.TestCase):
    def test_all_four_profiles_bind_to_their_own_repository(self):
        for app in ("storagedaddy", "performancedaddy", "browserdaddy", "contextdaddy"):
            with self.subTest(app=app):
                repository = (f"Significant-Hobbies/{app}" if app in ("storagedaddy", "performancedaddy", "contextdaddy")
                              else f"sarthakagrawal927/{app}")
                profile = profile_for(app, repository)
                self.assertEqual(profile["repository"], repository)

    def test_wrong_repository_and_unknown_app_fail_closed(self):
        with self.assertRaisesRegex(ValueError, "Wrong repository"):
            profile_for("browserdaddy", "sarthakagrawal927/performancedaddy")
        with self.assertRaisesRegex(ValueError, "Wrong repository"):
            profile_for("storagedaddy", "sarthakagrawal927/storagedaddy")
        with self.assertRaisesRegex(ValueError, "Wrong repository"):
            profile_for("contextdaddy", "sarthakagrawal927/contextdaddy")
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
            (shared / "appcast_core.py").write_text("appcast")
            (root / "scripts/appcast_core.py").write_text("appcast")
            (root / "scripts/sparkle_core.py").write_text("sparkle")
            with self.assertRaisesRegex(ValueError, "Missing shared Daddy utility"):
                check_shared_copies("browserdaddy", root, shared)
            (root / "site/worker-core.mjs").write_text("changed")
            with self.assertRaisesRegex(ValueError, "Shared Daddy utility drift"):
                check_shared_copies("browserdaddy", root, shared)
            (root / "site/worker-core.mjs").write_text("original")
            check_shared_copies("browserdaddy", root, shared)
            (root / "scripts/appcast_core.py").write_text("changed appcast")
            with self.assertRaisesRegex(ValueError, "Shared Daddy utility drift: scripts/appcast_core.py"):
                check_shared_copies("browserdaddy", root, shared)

    def test_appcast_copy_manifest_covers_only_the_three_sparkle_apps(self):
        for app in ("storagedaddy", "performancedaddy", "browserdaddy"):
            self.assertIn(("appcast_core.py", "scripts/appcast_core.py"), SHARED_COPIES[app])
        self.assertEqual(SHARED_COPIES["contextdaddy"], [])
        with tempfile.TemporaryDirectory() as directory:
            check_shared_copies("contextdaddy", Path(directory))

    def test_four_app_copy_cli_passes_integrated_fixture_and_rejects_new_copy_drift(self):
        shared = Path(__file__).with_name("shared")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for app, copies in SHARED_COPIES.items():
                for canonical, destination in copies:
                    target = root / app / destination
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes((shared / canonical).read_bytes())
            with patch('sys.argv', ['check_copies.py', '--fleet-root', str(root)]), \
                 patch('builtins.print'):
                self.assertEqual(check_copies_main(), 0)
                (root / 'performancedaddy/scripts/appcast_core.py').write_bytes(b'drift')
                self.assertEqual(check_copies_main(), 1)


if __name__ == "__main__":
    unittest.main()
