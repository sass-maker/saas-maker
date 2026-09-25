# Daddy macOS tooling

Issue: [sass-maker/saas-maker#139](https://github.com/sass-maker/saas-maker/issues/139).

This directory owns the credential-free parts of the four Daddy macOS app contract. `profiles.json` binds each app to one public repository and its current candidate test policy. `candidate.py` checks that identity, checks the pinned shared utility copies, runs the app's existing tests and Release build, and writes a candidate-only receipt. `release_contract.py` checks version/build identity, a post-staple checksum, the notary response shape, and Sparkle appcast metadata. Its receipt says `release-metadata-validated`; it does not assert code-signature, Gatekeeper, live download, or installed-app success.

The callable workflow is `.github/workflows/daddy-macos-candidate.yml`. It checks out the caller and this public tooling at an immutable commit SHA. It has read-only repository permission and no signing or publishing secrets. An app-owned protected release job remains responsible for signing, notarization, publication, and installed-app acceptance.

## Maintained copies

The `shared/` files are the canonical sources. App copies keep local packaging independently runnable:

| Canonical file | App copies |
| --- | --- |
| `shared/sparkle_core.py` | `storagedaddy`, `performancedaddy`, `browserdaddy`: `scripts/sparkle_core.py` |
| `shared/prepare-memory-pack.py` | `storagedaddy`, `contextdaddy`: `scripts/prepare-memory-pack.py` |
| `shared/worker-core.mjs` | `performancedaddy`, `browserdaddy`: `site/worker-core.mjs` |

When changing a canonical file, copy it into the listed apps and run `python3 -m unittest test_candidate test_release_contract` here, the affected app's smallest test, and the four-app copy check. The candidate workflow rejects a diverged copy. The app's wrapper, key, hostname, helper inputs, and product tests remain app-owned.

## Local checks

```bash
cd tooling/daddy-macos
python3 -m unittest test_candidate test_release_contract
python3 check_copies.py --fleet-root /path/to/fleet
```

`check_copies.py` only reads files. It is safe to use before the shared workflow is published. `add_shadow_ci.py` prepares the four caller workflows after the reusable workflow has a reviewed full commit SHA. It keeps the existing CI job while the shared job is compared in GitHub. Do not use a branch name or mutable tag as its revision.
