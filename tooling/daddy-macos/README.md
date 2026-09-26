# Daddy macOS tooling

Issue: [sass-maker/saas-maker#139](https://github.com/sass-maker/saas-maker/issues/139).

This directory owns the credential-free parts of the four Daddy macOS app contract. `profiles.json` binds each app to one public repository and its current candidate test policy. `candidate.py` checks that identity, checks the pinned shared utility copies, runs the app's existing tests and Release build, and writes a candidate-only receipt. `release_contract.py` checks version/build identity, a post-staple checksum, the notary response shape, and Sparkle appcast metadata. Its receipt says `release-metadata-validated`; it does not assert code-signature, Gatekeeper, live download, or installed-app success.

The callable workflow is `.github/workflows/daddy-macos-candidate.yml`. It checks out the caller and this public tooling at an immutable commit SHA. It has read-only repository permission and no signing or publishing secrets. `release_preflight.py` requires the exact release tag to point to the current `main` commit before a protected app-owned job proceeds. The preflight is a source gate, not a signed release. App-owned jobs remain responsible for signing, notarization, publication, and installed-app acceptance.

## Protected manual releases

Each app's manual `.github/workflows/release.yml` uses a `production-release` environment that requires owner review and accepts only `main`. It resolves the requested tag to the current `main` commit, reruns the shared candidate checks at that commit, and records the exact source SHA. It checks that these protected inputs are available without printing their values:

- `DEVELOPER_ID_CERT_P12_BASE64`
- `DEVELOPER_ID_CERT_PASSWORD`
- `DEVELOPER_ID_IDENTITY`
- `APPLE_NOTARY_API_KEY_P8_BASE64`
- `APPLE_NOTARY_KEY_ID`
- `APPLE_NOTARY_ISSUER_ID`
- `SPARKLE_ED25519_PRIVATE_KEY` (StorageDaddy, PerformanceDaddy, and BrowserDaddy only)
- `CLOUDFLARE_API_TOKEN` (an account token with Editor limited to the four Daddy Workers, account Workers Metadata Read-Only, and Workers Routes Write limited to `daddyrad.com` and `significanthobbies.com`)
- `CLOUDFLARE_ACCOUNT_ID`

Configure the values directly in each app's GitHub `production-release` environment. An ordinary push runs candidate CI only. A manual dispatch on `main` with an existing exact release tag waits for environment approval, verifies that tag points to the current `main`, builds its source, signs and notarizes the DMG, staples it, checks Gatekeeper and the post-staple checksum, and retains a qualified artifact. The three Sparkle apps also prepare a signed appcast. The ContextDaddy job verifies a checksum-pinned helper recovered from its prior public release. The job then stages the qualified assets in the app's existing Worker site, runs its checked-in site checks and Wrangler deploy, verifies the public download and feed bytes, and records the small site metadata change on `main`. PerformanceDaddy, BrowserDaddy, and ContextDaddy create a GitHub release from the qualified artifact; StorageDaddy retains website-only distribution. No job installs the app. The shared `release_contract.py` validates metadata only; it does not prove the Sparkle signature matches the app's public key.

`publish_site.py` and `verify_live.py` are credential-free. They reject receipt identity or checksum drift, wrong DMG filenames, older or conflicting site builds, and live byte mismatches. The app-owned workflows alone receive Cloudflare and GitHub publication authority. Cloudflare's hosted Wrangler deployment needs both protected inputs above; do not copy a local Wrangler login into GitHub. The publication commit uses the workflow's short-lived GitHub token after the live check. If `main` moves while a manual release is building, publication stops before deployment and must be restarted from a fresh tag.

Renew the one-year Cloudflare token before its September 26, 2027 expiration. Per-Worker Editor alone allowed the asset upload but caused Wrangler's account subdomain lookup to fail; the metadata and zone-route policies above completed the existing-site deployment.

## Maintained copies

The `shared/` files are the canonical sources. App copies keep local packaging independently runnable:

| Canonical file | App copies |
| --- | --- |
| `shared/sparkle_core.py` | `storagedaddy`, `performancedaddy`, `browserdaddy`: `scripts/sparkle_core.py` |
| `shared/appcast_core.py` | `storagedaddy`, `performancedaddy`, `browserdaddy`: `scripts/appcast_core.py` |
| `shared/prepare-memory-pack.py` | `storagedaddy`: `scripts/prepare-memory-pack.py`; ContextDaddy's current local feature branch also has this copy, but public `main` does not |
| `shared/worker-core.mjs` | `performancedaddy`, `browserdaddy`: `site/worker-core.mjs` |
| `shared/DaddyVisualCore.swift` | all four: `Sources/<App>/DaddyVisualCore.swift` |

The Swift copy owns the approved series palette, compact button geometry, and native menu bar open/quit actions. Each app keeps its existing theme and button names as adapters, as well as its own semantic color rules, screens, and behavior. PerformanceDaddy enables its existing hover wash through `hoverFeedback`. The main window in each app is single-instance and can reopen from the menu bar after closing. PerformanceDaddy's existing sampler and BrowserDaddy's consent-gated collector continue while their apps remain open; StorageDaddy scans and ContextDaddy refreshes remain explicit user actions. A change to the canonical source must be copied into all four apps and pass the candidate copy check before release; it does not update installed apps by itself.

When changing a canonical file, copy it into the listed apps and run `python3 -m unittest test_appcast_core test_candidate test_release_contract test_release_preflight` here, the affected app's smallest test, and the four-app copy check. The candidate workflow rejects a diverged copy. The appcast core stages a checksum-verified DMG and validates the exact signed enclosure; each app wrapper still owns Apple qualification policy, key handling, account, hostname, and product tests.

## Local checks

```bash
cd tooling/daddy-macos
python3 -m unittest test_appcast_core test_candidate test_release_contract test_release_preflight test_publish_site
python3 check_copies.py --fleet-root /path/to/fleet
```

`check_copies.py` only reads files. It is safe to use before the shared workflow is published. `add_shadow_ci.py` prepares the four caller workflows after the reusable workflow has a reviewed full commit SHA. It keeps the existing CI job while the shared job is compared in GitHub. Do not use a branch name or mutable tag as its revision.

`universal_products.py` builds PerformanceDaddy and BrowserDaddy separately for arm64 and x86_64, verifies each executable and byte-identical resource bundle, then creates a fresh `Products/Release` directory and a source-SHA receipt. Run it on a clean exact-commit checkout before either app's `package-release.py`; the candidate build also populates the default SwiftPM Sparkle artifact path needed by those packagers.

`launch_smoke.py` runs the assembled app executable briefly before notarization. A hosted SwiftPM binary may resolve `Bundle.module` at the `.app` root even when the packager correctly places artwork under `Contents/Resources`; a signed, notarized artifact can still crash on launch. Keep this check in the protected PerformanceDaddy and BrowserDaddy jobs, and qualify the installed update separately.
