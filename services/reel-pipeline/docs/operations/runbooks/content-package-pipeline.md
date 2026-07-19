# Source-backed marketing pipeline

## Contract

Each product remains the source of truth for its own facts and editorial material. Read-only extractors convert that material into `fleet.content-package.v1` packages. Packages carry the source URL, evidence URLs, brand, revision, channel variants, and separate package/variant approval states.

```text
High Signal ──────────┐
Significant Hobbies ──┼─> proposed content packages ─> approval ─> brand video
SWE Interview Prep ───┘                                      │
Project campaigns ─────┘                                      │
                                                             └─> distribution approval ─> channel account
```

Reel Pipeline owns media production and posting adapters. It does not become the source of product claims. SaaS Maker provides the approval UI and queue, while package and receipt files keep the boundary portable.

## Commands

Install the credential-free account routing template and inspect readiness:

```bash
npm run check:social -- --install
```

All six Instagram/YouTube account routes are versioned. The ignored
`config/social-accounts.json` contains only environment-variable references;
tokens never enter git or the Fleet dashboard.

Extract proposed packages without modifying source projects:

```bash
npm run content -- extract --source all --fleet-root ../ --catalog /path/to/learning-sources.json --out tmp/content-packages
```

`config/project-campaigns.json` makes the finished evergreen plans for
AliveVille, Karte, RolePatch, and SaaS Maker executable. Each campaign points
back to its owning repository status or README, carries SEO keywords and a
canonical destination, and produces proposed Instagram and YouTube variants.
The source projects remain authoritative; campaign extraction is read-only.

Sync one source-backed package per active brand into SaaS Maker. Duplicate
source revisions are skipped, and sync pauses when 12 items already need review:

```bash
npm run marketing -- sync
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

The active launch scope is Instagram Reels and YouTube Shorts. TikTok/Postiz is deferred and does not count against current readiness. A missing account mapping is a hard error, never a fallback to another brand.

## Operator loop

1. Daily source sync creates `generated` SaaS Maker rows. Accepting one is the
   explicit content/media-production approval.
2. The supervised machine service runs every minute, renders accepted packages,
   uploads the MP4 to the existing `reel-artifacts` R2 bucket, and returns a
   proposed distribution request to the same row.
3. Cockpit shows the video as ready. `Approve & schedule` is a separate owner
   action and may be immediate or future-dated.
4. The minute service claims a SHA-256 idempotency key before calling YouTube or
   Instagram. A crashed/inflight claim never silently retries and duplicates a
   release.
5. Retryable provider failures use bounded exponential backoff (five attempts,
   five minutes through six hours). Permanent failures stop and notify the
   operator through the Fleet notification outbox.
6. A platform ID/URL is recorded only after the provider succeeds. The public
   Fleet dashboard receives aggregate queue counts every minute, never package
   copy, source evidence, credentials, or private links.

The LaunchAgent is managed with:

```bash
../fleet-ops/scripts/agent-bin/marketing-control-service status
../fleet-ops/scripts/agent-bin/marketing-control-service restart
```

## Approval invariants

- Extraction produces `proposed`, never `approved`.
- Package approval permits media production only.
- Distribution approval permits one exact package revision, variant, channel, artifact, and account.
- Pending items never become accepted because they are old.
- Content approval never implies distribution approval.
- Manual preparation records `prepared`, not `posted`.
- Platform release IDs and URLs are recorded only after a provider reports success.
