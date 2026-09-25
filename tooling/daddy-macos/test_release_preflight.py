from pathlib import Path
import subprocess
import tempfile
import unittest

from release_preflight import inspect_tag


class ReleasePreflightTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.app = "performancedaddy"
        self.repository = "sarthakagrawal927/performancedaddy"
        self.git("init", "-b", "main")
        self.git("config", "user.name", "Test")
        self.git("config", "user.email", "test@example.invalid")
        (self.root / "source.txt").write_text("first\n")
        self.git("add", "source.txt")
        self.git("commit", "-m", "first")
        self.git("tag", "v1.2.3-4")

    def git(self, *arguments):
        return subprocess.run(["git", "-C", str(self.root), *arguments], check=True, capture_output=True, text=True)

    def test_accepts_tag_reachable_from_main(self):
        receipt = inspect_tag(self.app, self.repository, self.root, "v1.2.3-4")
        self.assertEqual(receipt["state"], "release-source-preflight-passed")
        self.assertEqual(receipt["sourceSha"], receipt["mainShaAtCheck"])
        self.assertEqual(receipt["build"], 4)

    def test_rejects_wrong_repository_or_tag(self):
        with self.assertRaisesRegex(ValueError, "Wrong repository"):
            inspect_tag(self.app, "someone/other", self.root, "v1.2.3-4")
        with self.assertRaisesRegex(ValueError, "Release tag"):
            inspect_tag(self.app, self.repository, self.root, "v1.2.3-0")

    def test_rejects_unmerged_tag(self):
        self.git("checkout", "-b", "feature")
        (self.root / "source.txt").write_text("feature\n")
        self.git("commit", "-am", "feature")
        self.git("tag", "v1.2.4-5")
        self.git("checkout", "main")
        with self.assertRaisesRegex(ValueError, "not reachable"):
            inspect_tag(self.app, self.repository, self.root, "v1.2.4-5")

    def test_rejects_dirty_tracked_checkout(self):
        (self.root / "source.txt").write_text("changed\n")
        with self.assertRaisesRegex(ValueError, "clean tracked"):
            inspect_tag(self.app, self.repository, self.root, "v1.2.3-4")


if __name__ == "__main__":
    unittest.main()
