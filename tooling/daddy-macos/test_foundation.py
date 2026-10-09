import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SHARED = Path(__file__).with_name("shared")
spec = importlib.util.spec_from_file_location("foundation", SHARED / "check-daddy-foundation.py")
foundation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(foundation)


class FoundationTests(unittest.TestCase):
    def fixture(self, app, root):
        manifest = json.loads((SHARED / "daddy-foundation.json").read_text())
        (root / "scripts").mkdir()
        (root / "scripts/daddy-foundation.json").write_text(json.dumps(manifest))
        for name in manifest["copies"]:
            if name == "DaddyLifecycle.swift" and app == "contextdaddy":
                continue
            relative = (f"Tests/{foundation.APPS[app]}Tests/{name}" if name.endswith("Tests.swift") else
                        f"Sources/{foundation.APPS[app]}/{name}" if name.endswith(".swift") else f"scripts/{name}")
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes((SHARED / name).read_bytes())
        (root / "Package.swift").write_text('.package(url: "https://github.com/sparkle-project/Sparkle", exact: "2.9.6")')
        workflows = root / ".github/workflows"
        workflows.mkdir(parents=True)
        revision = "a" * 40
        (workflows / "ci.yml").write_text(f'daddy-macos-candidate.yml@{revision}\ntooling-ref: {revision}\n')
        (workflows / "release.yml").write_text(f'repository: sass-maker/saas-maker\nref: {revision}\n')

    def test_each_app_passes_with_identical_native_foundation(self):
        for app in foundation.APPS:
            with self.subTest(app=app), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                self.fixture(app, root)
                foundation.check(app, root)

    def test_changed_or_missing_native_copy_fails(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.fixture("contextdaddy", root)
            path = root / "Sources/ContextDaddy/DaddyAppUpdates.swift"
            path.write_text("drift")
            with self.assertRaisesRegex(ValueError, "foundation drift"):
                foundation.check("contextdaddy", root)
            path.unlink()
            with self.assertRaisesRegex(ValueError, "foundation drift"):
                foundation.check("contextdaddy", root)

    def test_workflow_tooling_and_release_pins_cannot_drift(self):
        for filename in ("ci.yml", "release.yml"):
            with self.subTest(filename=filename), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                self.fixture("browserdaddy", root)
                path = root / ".github/workflows" / filename
                manifest = json.loads((SHARED / "daddy-foundation.json").read_text())
                path.write_text(path.read_text().replace("a" * 40, "0" * 40))
                with self.assertRaisesRegex(ValueError, "foundation"):
                    foundation.check("browserdaddy", root)

    def test_sparkle_version_cannot_drift(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.fixture("storagedaddy", root)
            path = root / "Package.swift"
            path.write_text(path.read_text().replace("2.9.6", "2.8.0"))
            with self.assertRaisesRegex(ValueError, "Sparkle dependency"):
                foundation.check("storagedaddy", root)
