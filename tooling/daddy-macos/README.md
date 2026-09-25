# Daddy macOS tooling

Issue: [sass-maker/saas-maker#139](https://github.com/sass-maker/saas-maker/issues/139).

This directory owns the credential-free parts of the four Daddy macOS app contract. `profiles.json` binds each app to one public repository and its current candidate test policy. `candidate.py` checks that identity, checks the pinned shared utility copies, runs the app's existing tests and Release build, and writes a candidate-only receipt. `release_contract.py` checks version/build identity, a post-staple checksum, the notary response shape, and Sparkle appcast metadata. Its receipt says `release-metadata-validated`; it does not assert code-signature, Gatekeeper, live download, or installed-app success.

The callable workflow is `.github/workflows/daddy-macos-candidate.yml`. It checks out the caller and this public tooling at an immutable commit SHA. It has read-only repository permission and no signing or publishing secrets. `release_preflight.py` checks an exact release tag against `main` before a protected app-owned job proceeds. The preflight is a source gate, not a signed release. App-owned jobs remain responsible for signing, notarization, publication, and installed-app acceptance.

## Protected release preflight

Each app's manual `.github/workflows/release.yml` uses a `production-release` environment that requires owner review and accepts only `main`. It resolves the requested tag to an immutable commit reachable from `main`, reruns the shared candidate checks at that commit, and records the exact source SHA. It checks that these protected inputs are available without printing their values:

- `DEVELOPER_ID_CERT_P12_BASE64`
- `DEVELOPER_ID_CERT_PASSWORD`
- `DEVELOPER_ID_IDENTITY`
- `APPLE_NOTARY_API_KEY_P8_BASE64`
- `APPLE_NOTARY_KEY_ID`
- `APPLE_NOTARY_ISSUER_ID`

Configure the values directly in each app's GitHub `production-release` environment. The current workflow stops after preflight; it does not import a certificate, sign, notarize, publish, or install. Enable those gates only after the app's packaging adapter, architecture, resources, and product acceptance can be checked on the GitHub-hosted runner.

## Maintained copies

The `shared/` files are the canonical sources. App copies keep local packaging independently runnable:

| Canonical file | App copies |
| --- | --- |
| `shared/sparkle_core.py` | `storagedaddy`, `performancedaddy`, `browserdaddy`: `scripts/sparkle_core.py` |
| `shared/prepare-memory-pack.py` | `storagedaddy`: `scripts/prepare-memory-pack.py`; ContextDaddy's current local feature branch also has this copy, but public `main` does not |
| `shared/worker-core.mjs` | `performancedaddy`, `browserdaddy`: `site/worker-core.mjs` |

When changing a canonical file, copy it into the listed apps and run `python3 -m unittest test_candidate test_release_contract test_release_preflight` here, the affected app's smallest test, and the four-app copy check. The candidate workflow rejects a diverged copy. The app's wrapper, key, hostname, helper inputs, and product tests remain app-owned.

## Local checks

```bash
cd tooling/daddy-macos
python3 -m unittest test_candidate test_release_contract test_release_preflight
python3 check_copies.py --fleet-root /path/to/fleet
```

`check_copies.py` only reads files. It is safe to use before the shared workflow is published. `add_shadow_ci.py` prepares the four caller workflows after the reusable workflow has a reviewed full commit SHA. It keeps the existing CI job while the shared job is compared in GitHub. Do not use a branch name or mutable tag as its revision.
