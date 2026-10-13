from pathlib import Path
import plistlib
import tempfile
import unittest
from unittest.mock import patch

from universal_products import build_products, copy_resource_bundle, make_universal, resource_hashes


class UniversalProductsTests(unittest.TestCase):
    def test_resource_tree_is_byte_checked(self):
        with tempfile.TemporaryDirectory() as directory:
            bundle = Path(directory)
            (bundle / "Contents/Resources").mkdir(parents=True)
            asset = bundle / "Contents/Resources/art.png"
            asset.write_bytes(b"first")
            first = resource_hashes(bundle)
            asset.write_bytes(b"second")
            self.assertNotEqual(first, resource_hashes(bundle))
            asset.unlink()
            with self.assertRaisesRegex(ValueError, "Empty"):
                resource_hashes(bundle)

    def test_only_declared_universal_apps_are_accepted(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaisesRegex(ValueError, "not configured"):
                make_universal("contextdaddy", "Significant-Hobbies/contextdaddy", root, root / "Release")
            with self.assertRaisesRegex(ValueError, "Wrong repository"):
                make_universal("performancedaddy", "someone/other", root, root / "Release")

    def test_flat_swiftpm_resources_become_macos_bundle_resources(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "flat.bundle"
            source.mkdir()
            (source / "icon.png").write_bytes(b"artwork")
            copied = copy_resource_bundle(source, root / "output.bundle")
            self.assertEqual(copied, {"Contents/Resources/icon.png": resource_hashes(source)["icon.png"]})
            self.assertEqual((root / "output.bundle/Contents/Resources/icon.png").read_bytes(), b"artwork")

    def test_macos_bundle_resources_keep_their_layout(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "macos.bundle"
            (source / "Contents/Resources").mkdir(parents=True)
            (source / "Contents/Resources/icon.png").write_bytes(b"artwork")
            copied = copy_resource_bundle(source, root / "output.bundle")
            self.assertEqual(copied, resource_hashes(source))

    def test_build_uses_each_apps_declared_minimum_macos_version(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "Support").mkdir()
            products = root / "Release"
            products.mkdir()
            for minimum in ("14.0", "15.0"):
                (root / "Support/Info.plist").write_bytes(plistlib.dumps({"LSMinimumSystemVersion": minimum}))
                for architecture in ("arm64", "x86_64"):
                    with self.subTest(minimum=minimum, architecture=architecture), \
                            patch("universal_products.subprocess.run") as run, \
                            patch("universal_products.subprocess.check_output", return_value=str(products)) as query:
                        self.assertEqual(build_products(root, architecture), products)
                        command = run.call_args.args[0]
                        self.assertEqual(command[command.index("--triple") + 1], f"{architecture}-apple-macosx{minimum}")
                        self.assertEqual(query.call_args.args[0], command + ["--show-bin-path"])

    def test_invalid_minimum_macos_version_fails_before_build(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "Support").mkdir()
            for minimum in (None, 15, "15.0 --other-option"):
                values = {} if minimum is None else {"LSMinimumSystemVersion": minimum}
                (root / "Support/Info.plist").write_bytes(plistlib.dumps(values))
                with self.subTest(minimum=minimum), patch("universal_products.subprocess.run") as run:
                    with self.assertRaisesRegex(ValueError, "Invalid declared minimum"):
                        build_products(root, "arm64")
                    run.assert_not_called()

    def assemble_fixture(self, root, dependency_mode="matching"):
        (root / "Package.swift").write_text("// fixture")
        products = {}
        for architecture in ("arm64", "x86_64"):
            directory = root / architecture / "Release"
            directory.mkdir(parents=True)
            products[architecture] = directory
            (directory / "BrowserDaddy").write_bytes(architecture.encode())
            bundle = directory / "BrowserDaddy_BrowserDaddy.bundle"
            bundle.mkdir()
            (bundle / "app.png").write_bytes(b"app resource")
            if dependency_mode == "missing" and architecture == "x86_64":
                continue
            dependency = directory / "SaaSMakerUI_SaaSMakerUI.bundle"
            (dependency / "Contents/Resources").mkdir(parents=True)
            data = architecture.encode() if dependency_mode == "different" else b"shared UI resource"
            (dependency / "Contents/Resources/ui.png").write_bytes(data)
        return products

    def assemble(self, root, products):
        output = (root / "Products/Release").resolve()

        def lipo(command, **kwargs):
            Path(command[-1]).write_bytes(b"universal executable")

        def archs(binary):
            return {"arm64", "x86_64"} if binary.parent == output else {binary.parent.parent.name}

        with patch("universal_products.build_products", side_effect=lambda _, arch: products[arch]), \
                patch("universal_products.architectures", side_effect=archs), \
                patch("universal_products.subprocess.run", side_effect=lipo), \
                patch("universal_products.subprocess.check_output", side_effect=[b"", "fixture-sha\n"]):
            return make_universal("browserdaddy", "Significant-Hobbies/browserdaddy", root, output)

    def test_universal_products_include_verified_dependency_resources(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            receipt = self.assemble(root, self.assemble_fixture(root))
            dependency = "SaaSMakerUI_SaaSMakerUI.bundle"
            self.assertEqual(set(receipt["resourceBundles"]), {receipt["resourceBundle"], dependency})
            self.assertEqual(receipt["resourceHashes"], receipt["resourceBundles"][receipt["resourceBundle"]])
            self.assertEqual(receipt["resourceBundles"][dependency], resource_hashes(root / "Products/Release" / dependency))
            self.assertEqual((root / "Products/Release" / dependency / "Contents/Resources/ui.png").read_bytes(), b"shared UI resource")

    def test_dependency_mismatch_fails_before_creating_output(self):
        for mode, message in (("missing", "names differ"), ("different", "bundles differ")):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                with self.assertRaisesRegex(ValueError, message):
                    self.assemble(root, self.assemble_fixture(root, mode))
                self.assertFalse((root / "Products/Release").exists())

    def test_resource_bundle_root_symlink_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.bundle"
            source.mkdir()
            (source / "asset.png").write_bytes(b"resource")
            link = root / "linked.bundle"
            link.symlink_to(source, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, "symlink is not allowed"):
                resource_hashes(link)


if __name__ == "__main__":
    unittest.main()
