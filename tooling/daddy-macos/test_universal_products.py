from pathlib import Path
import tempfile
import unittest

from universal_products import make_universal, resource_hashes


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


if __name__ == "__main__":
    unittest.main()
