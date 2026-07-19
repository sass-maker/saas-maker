# Auto-posting

How a finished reel reaches YouTube Shorts and Instagram Reels with zero clicks.

## Current state

| Platform | Mode | Status |
|---|---|---|
| YouTube Shorts | API auto-upload, multi-account (`reel/src/publishers/youtube.rs`) | Shipped |
| Instagram Reels | Standard Access API, multi-account (`reel/src/publishers/instagram.rs`) | Shipped — see [`instagram-setup.md`](./instagram-setup.md) |
| Autopilot loop | SaaS Maker → intake hold → render → post (`reel autopilot`, `reel/src/autopilot.rs`) | Shipped |
| Account routing | `config/social-accounts.json` + channel routing (project_slug → handle) | Shipped |
| Missed-post recovery | `reel post --missed-only --execute` / `npm run post:ready -- --missed-only` | Shipped |
| Provider metrics backfill | `reel metrics --execute` / `npm run sync:metrics` patches metrics into SaaS Maker notes | Shipped |

Production posting runs in Rust (`reel post`, `reel/src/marketing_posting.rs`). The
JS `src/posting.js` / `src/publishers/*.js` clients back the local dev server
(`src/server/index.js`); manual posting via Meta Business Suite or YouTube Studio
still works as a backup.

## End-to-end flow

```
SaaS Maker draft (status=pending)
        │
        │  N min hold window (env: AUTOPILOT_HOLD_WINDOW_MS, default 30m)
        ▼
auto-accept (status=accepted)
        │
│  render_accepted_marketing_posts → mock / HTML / ASCII / Grok MP4 / reel-maker / MoneyPrinterTurbo
        ▼
artifact in R2 + asset_url on the post
        │
        │  post_ready_marketing_videos with ChannelRoutingPoster
        ▼
YT publish ── or ── IG container → poll → publish
        │
        ▼
status=sent, posted_at set
```

One process — the Rust `reel autopilot` daemon — owns the whole loop.

## Hold window (review gate)

Posts SaaS Maker creates start in `status: pending`. Autopilot only auto-accepts them once `created_at` is older than `AUTOPILOT_HOLD_WINDOW_MS` (default 30 min). If you reject a post in the SaaS Maker dashboard before the window expires, it never gets posted. Knob lives in `.env`; no code change to dial it in or out.

To bypass the gate entirely, set `AUTOPILOT_HOLD_WINDOW_MS=0`. To run with the old human-accept-only behavior, set `AUTOPILOT_INTAKE_STATUS=__never__` so nothing matches the intake filter.

## Missed-post recovery

Use a missed-only pass when the scheduler was down or a previous post tick failed
after the scheduled time. The pass only touches accepted reel posts that already
have a rendered asset, have a `scheduled_for` timestamp in the past, and do not
have `posted_at`.

```bash
npm run post:ready -- --missed-only
```

The same option is available directly through Rust:

```bash
cargo run --quiet --manifest-path reel/Cargo.toml -- post --execute --repo-root . --missed-only
```

## Metrics backfill

Posting writes `posting_provider` and `external_id` notes after a successful
YouTube/Instagram publish. Run metrics sync after posts have had time to accrue
views:

```bash
npm run sync:metrics
```

The same command is available directly through Rust:

```bash
cargo run --quiet --manifest-path reel/Cargo.toml -- metrics --execute --repo-root .
```

The sync scans `status=sent` marketing posts by default, skips posts without a
supported provider/release ID, fetches YouTube video statistics or Instagram
media insights, and replaces the prior `metric_*` note block so repeated runs
do not accumulate stale metrics.

## Two daemons, not one

The pipeline has two long-running daemons, both on the Rust `reel` CLI. They are
NOT redundant:

| Daemon | Polls | When you'd run it |
|---|---|---|
| `reel watch --execute` (`reel/src/watcher.rs`) | the Cloudflare worker for the *reel* flow (swipe UI) | If you use the worker-driven flow |
| `reel autopilot --execute` (`reel/src/autopilot.rs`) | SaaS Maker for the *marketing-post* flow | The auto-posting path this doc describes |

Both need ffmpeg + Node (for `render-pro.js` / media adapters) + cargo + a reasonable amount of RAM. Render concurrency knob: `PIPELINE_RENDER_CONCURRENCY` (default 1). See [`deployment.md`](./deployment.md) for which host to run them on.

## Where to run this

The autopilot is a long-running daemon + a daily token-refresh cron. **Don't run it on your active workstation** — see [`deployment.md`](./deployment.md) for the per-host setup (Hetzner CCX23 recommended; M1 16GB viable as a zero-cost fallback). That doc carries the systemd units, launchd plists, and the migration playbook.

The refresh script prints new tokens to stdout; set `IG_REFRESH_OUTPUT=.env.ig-refreshed` for a sourceable fragment if you want hands-off rotation.

## Multi-account config

Single source of truth: `config/social-accounts.json` (gitignored; check `config/social-accounts.example.json` into VCS). Shape:

```json
{
  "youtube": {
    "tutoring": {
      "clientIdEnv": "YT_TUTORING_CLIENT_ID",
      "clientSecretEnv": "YT_TUTORING_CLIENT_SECRET",
      "refreshTokenEnv": "YT_TUTORING_REFRESH_TOKEN",
      "defaultPrivacy": "private",
      "projects": ["tutoring-q3"],
      "default": true
    }
  },
  "instagram": {
    "tutoring": {
      "appIdEnv": "IG_TUTORING_APP_ID",
      "appSecretEnv": "IG_TUTORING_APP_SECRET",
      "userIdEnv": "IG_TUTORING_USER_ID",
      "longLivedTokenEnv": "IG_TUTORING_LONG_LIVED_TOKEN",
      "projects": ["tutoring-q3"],
      "default": true
    }
  }
}
```

Routing rule, in order of preference:
1. `marketingPost.account_slug === <slug>` → that account.
2. `marketingPost.project_slug` in `projects[]` → that account.
3. Account marked `default: true` → fallback.

Adding a second handle is editing the JSON + appending env vars. No code change.

## One-time setup on the production node

YouTube:
```bash
YT_TUTORING_CLIENT_ID=... YT_TUTORING_CLIENT_SECRET=... \
  npm run yt:bootstrap
# paste the printed refresh token into .env as YT_TUTORING_REFRESH_TOKEN
```

Instagram (per handle):
```bash
IG_APP_ID=... IG_APP_SECRET=... IG_ACCOUNT_SLUG=tutoring \
  npm run ig:bootstrap
# paste the printed USER_ID + LONG_LIVED_TOKEN into .env
```

Then verify:
```bash
cargo run --quiet --manifest-path reel/Cargo.toml -- autopilot --once --execute --repo-root .
```

## Operational details

- **YT scheduling**: `videos.insert` accepts `status.publishAt`; the publisher forwards `marketingPost.scheduled_for`. YT uploads as `private` then auto-flips at the scheduled time.
- **YT quota**: default 10k units/day; an upload is ~1,600 units → ~6/day per project. Request more via GCP console if needed.
- **IG public-URL requirement**: Meta fetches the video; the pipeline must upload to R2 (`REEL_ARTIFACT_R2_BUCKET`) and pass the public URL. Local-only renders won't post.
- **IG token TTL**: 60 days; daily refresh cron extends another 60. If a token expires (refresh job broken for 60 days), re-run `ig:bootstrap` for that handle.
- **Failure isolation**: posting failures are classified, patched back to SaaS
  Maker notes, and isolated per post. A single bad post does not take down the loop.
- **Metrics backfill**: publisher clients fetch YouTube video statistics and
  Instagram media insights for the saved `external_id`; `reel metrics --execute`
  patches the latest values back to SaaS Maker notes.

## Files

- `reel/src/publishers/youtube.rs`, `reel/src/publishers/instagram.rs` — production wire-protocol clients
- `reel/src/marketing_posting.rs` — `ManualPoster` / `ChannelRoutingPoster` + `post_ready_marketing_videos`
- `reel/src/marketing_metrics.rs` — metrics target parsing, provider fetch, SaaS Maker note patching
- `reel/src/autopilot.rs` + `reel/src/autopilot_daemon.rs` — `run_autopilot_tick` + auto-accept intake + daemon loop
- `reel/src/config.rs` — env-pointer loader + channel routing
- `src/posting.js` / `src/publishers/*.js` / `src/config/social-accounts.js` — JS clients backing the local dev server (`src/server/index.js`), not the production path
- `scripts/{youtube,instagram}-oauth-bootstrap.js` — one-shot OAuth helpers
- `scripts/refresh-instagram-tokens.js` — daily IG token refresh
- `config/social-accounts.example.json` — multi-account config template
