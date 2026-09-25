from pathlib import Path
import tempfile
import unittest

from universal_products import copy_resource_bundle, make_universal, resource_hashes


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
                make_universal("contextdaddy", "sarthakagrawal927/contextdaddy", root, root / "Release")
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


if __name__ == "__main__":
    unittest.main()
