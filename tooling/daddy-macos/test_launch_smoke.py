from pathlib import Path
import plistlib
import tempfile
import unittest

from launch_smoke import smoke


class LaunchSmokeTests(unittest.TestCase):
    def test_exiting_candidate_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            app = Path(directory) / "Fixture.app"
            executable = app / "Contents/MacOS/Fixture"
            executable.parent.mkdir(parents=True)
            (app / "Contents/Info.plist").write_bytes(plistlib.dumps({"CFBundleExecutable": "Fixture"}))
            executable.write_text("#!/bin/sh\nexit 7\n")
            executable.chmod(0o755)
            with self.assertRaisesRegex(ValueError, "status 7"):
                smoke(app, seconds=5)

    def test_running_candidate_passes(self):
        with tempfile.TemporaryDirectory() as directory:
            app = Path(directory) / "Fixture.app"
            executable = app / "Contents/MacOS/Fixture"
            executable.parent.mkdir(parents=True)
            (app / "Contents/Info.plist").write_bytes(plistlib.dumps({"CFBundleExecutable": "Fixture"}))
            executable.write_text("#!/usr/bin/env python3\nimport time\ntime.sleep(10)\n")
            executable.chmod(0o755)
            smoke(app, seconds=0.05)


if __name__ == "__main__":
    unittest.main()
