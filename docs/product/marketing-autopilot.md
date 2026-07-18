# Marketing Autopilot

The SaaS Maker queue-driven flow: accepted marketing items become rendered
MP4s and gated posts. This is internal tooling, not a visitor product surface.

## End-to-end

```text
SaaS Maker draft (status=pending)
        │  N min hold window (env: AUTOPILOT_HOLD_WINDOW_MS, default 30m)
        ▼
auto-accept (status=accepted)
        │  renderAcceptedMarketingPosts → mock / HTML / ASCII / Grok MP4 / reel-maker / MoneyPrinterTurbo
        ▼
artifact in R2 + asset_url on the post
        │  postReadyMarketingVideos with ChannelRoutingProvider
        ▼
YT publish ── or ── IG container → poll → publish
        │
        ▼
status=sent, posted_at set
```

One process — `npm run autopilot` — owns the whole loop. The Rust CLI is the
canonical entrypoint (`reel autopilot`); Node remains for `render-pro.js`,
OAuth bootstrap, and the local dev server.

## Hold window (review gate)

Posts SaaS Maker creates start `status: pending`. Autopilot only auto-accepts
once `created_at` is older than `AUTOPILOT_HOLD_WINDOW_MS` (default 30 min).
Rejecting a post in the SaaS Maker dashboard before the window expires
prevents it from ever posting.

- Bypass the gate: `AUTOPILOT_HOLD_WINDOW_MS=0`.
- Restore human-accept-only: `AUTOPILOT_INTAKE_STATUS=__never__`.

## Missed-post recovery

```bash
npm run post:ready -- --missed-only
# or
cargo run --quiet --manifest-path reel/Cargo.toml -- post --execute --repo-root . --missed-only
```

Touches only accepted reel posts that already have a rendered asset, a past
`scheduled_for`, and no `posted_at`.

## Metrics backfill

```bash
npm run sync:metrics
# or
cargo run --quiet --manifest-path reel/Cargo.toml -- metrics --execute --repo-root .
```

Scans `status=sent` posts, skips posts without a supported provider/release ID,
fetches YouTube video statistics or Instagram media insights, and replaces the
prior `metric_*` note block so repeated runs do not accumulate stale metrics.

## Two daemons, not one

| Daemon | Polls | When you'd run it |
| --- | --- | --- |
| `reel watch --execute` (Rust) | the Cloudflare Worker for the *reel* flow (swipe UI) | If you use the worker-driven flow |
| `reel autopilot` (Rust) | SaaS Maker for the *marketing-post* flow | The auto-posting path |

Both need ffmpeg + Node + reasonable RAM. Render concurrency knob:
`PIPELINE_RENDER_CONCURRENCY` (default 1). See
[`operations/deployment.md`](../operations/deployment.md) for which host.

## Posting providers

- YouTube Shorts — API auto-upload, multi-account (`reel/src/publishers/youtube.rs`).
- Instagram Reels — Standard Access API, multi-account
  (`reel/src/publishers/instagram.rs`); see
  [`operations/instagram-setup.md`](../operations/instagram-setup.md).
- Manual handoff — Meta Business Suite / YouTube Studio backup; the manual
  provider in `src/posting.js` is unchanged.
- Upload-Post — generic third-party adapter (`src/posting.js`).

Posting providers declare capability/preflight rules: YouTube requires a local
video path; Instagram/Upload-Post require a public video URL; captions and
tags are bounded before API calls; failed posts are classified as
`needs_reconnect`/`quota`/`rate_limited`/`provider_down`/`bad_caption`/`bad_asset`.
Post scans isolate failures per item and patch structured error notes back to
SaaS Maker while leaving the queue item accepted for operator review. Posting
notes include the platform `external_id` for later metrics backfill.

## Multi-account config

Single source of truth: `config/social-accounts.json` (gitignored; template at
`config/social-accounts.example.json`). The config holds only environment
variable *names*; tokens never enter git. Routing rule, in order of preference:

1. `marketingPost.account_slug === <slug>` → that account.
2. `marketingPost.project_slug` in `projects[]` → that account.
3. Account marked `default: true` → fallback.

Adding a second handle is editing the JSON + appending env vars. No code
change. See [`operations/auto-posting.md`](../operations/auto-posting.md) for
the full setup and [`operations/instagram-setup.md`](../operations/instagram-setup.md)
for Instagram.

## Operational details

- **YT scheduling**: `videos.insert` accepts `status.publishAt`; the publisher
  forwards `marketingPost.scheduled_for`. YT uploads as `private` then
  auto-flips at the scheduled time.
- **YT quota**: default 10k units/day; an upload is ~1,600 units → ~6/day per
  project. Request more via GCP console if needed.
- **IG public-URL requirement**: Meta fetches the video; the pipeline must
  upload to R2 (`REEL_ARTIFACT_R2_BUCKET`) and pass the public URL. Local-only
  renders won't post.
- **IG token TTL**: 60 days; daily refresh cron extends another 60. If a token
  expires, re-run `ig:bootstrap` for that handle.
- **IG limits**: 25 published posts per account per 24 hours (Reels and
  Stories share the bucket).
