# Source-backed marketing pipeline

## Contract

Each product remains the source of truth for its own facts and editorial material. Read-only extractors convert that material into `fleet.content-package.v1` packages. Packages carry the source URL, evidence URLs, brand, revision, channel variants, and separate package/variant approval states.

```text
High Signal ──────────┐
Significant Hobbies ──┼─> proposed content packages ─> approval ─> brand video
SWE Interview Prep ───┘                                      │
                                                             └─> distribution approval ─> channel account
```

Reel Pipeline owns media production and posting adapters. It does not become the source of product claims. SaaS Maker can provide the approval UI and queue, but package and receipt files keep the boundary portable.

## Commands

Extract proposed packages without modifying source projects:

```bash
npm run content -- extract --source all --fleet-root ../ --catalog /path/to/learning-sources.json --out tmp/content-packages
```

Render an approved package locally with Kokoro, Playwright Chromium, and FFmpeg:

```bash
npm run render:package -- --file approved-package.json --out artifacts/brand-video
```

Prepare a proposed distribution request. This never posts:

```bash
npm run distribution -- --file approved-package.json --receipt receipt.json --provider native --out distribution-request.json
```

Live execution requires an independently approved request, an exact package/media revision match, a brand/channel account mapping in `config/brand-channels.json`, and resolved credentials in `config/social-accounts.json`:

```bash
npm run distribution -- --file approved-package.json --receipt receipt.json --request approved-distribution-request.json --execute --accounts config/social-accounts.json
```

TikTok stays blocked until the Postiz adapter and an audited TikTok app/account connection are configured. A missing account mapping is a hard error, never a fallback to another brand.

## Approval invariants

- Extraction produces `proposed`, never `approved`.
- Package approval permits media production only.
- Distribution approval permits one exact package revision, variant, channel, artifact, and account.
- Pending items never become accepted because they are old.
- Manual preparation records `prepared`, not `posted`.
- Platform release IDs and URLs are recorded only after a provider reports success.
