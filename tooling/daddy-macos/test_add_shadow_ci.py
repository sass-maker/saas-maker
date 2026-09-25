import unittest

from add_shadow_ci import updated_ci


class ShadowCiTests(unittest.TestCase):
    def test_preserves_existing_job_and_pins_new_job(self):
        source = "name: CI\non:\n  pull_request:\njobs:\n  test:\n    runs-on: macos-26\n"
        sha = "a" * 40
        result = updated_ci(source, "storagedaddy", sha)
        self.assertIn("  test:\n    runs-on: macos-26", result)
        self.assertIn(f"daddy-macos-candidate.yml@{sha}", result)
        self.assertEqual(updated_ci(result, "storagedaddy", sha), result)

    def test_rejects_mutable_ref_and_wrong_existing_job(self):
        source = "jobs:\n  test:\n    runs-on: macos-26\n"
        with self.assertRaisesRegex(ValueError, "full commit SHA"):
            updated_ci(source, "storagedaddy", "main")
        with self.assertRaisesRegex(ValueError, "differs"):
            updated_ci(source + "\n  shared_candidate:\n    uses: other\n", "storagedaddy", "a" * 40)


if __name__ == "__main__":
    unittest.main()
