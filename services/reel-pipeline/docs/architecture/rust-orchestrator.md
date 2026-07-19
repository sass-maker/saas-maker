# Rust orchestrator architecture (`reel/`)

This document maps the two orchestration flows and the Rust crate (`reel/`) that
now owns them. The Rust cutover is **complete**: the crate owns all production
orchestration and mode dispatch, and the old Node glue scripts
(`auto-render-watcher.js`, `marketing-autopilot.js`) are deleted. It does NOT
touch the git submodules under `engines/`, and it does not reimplement ffmpeg,
Chrome capture, TTS, or the render engines — those stay behind trait interfaces
with one shell-out impl each (Node owns the pixels). The JS
`src/pipeline.js` orchestration is retained only for the local dev server
(`src/server/index.js`) and the studio / anonymous / significant-content
surfaces; the production autopilot, watcher, render-accepted, post, and metrics
entrypoints are the Rust CLI.

## The two real flows

The pipeline has two non-overlapping orchestration flows (the README and
package scripts expose both):

### 1. Worker reel flow — the ONE production render path

```
Cloudflare Worker (src/worker/index.js, R2ReelStore)
  POST /reels[/signal]  → store reel draft in R2
  GET  /review          → swipe review UI (src/review-ui.js)
  PATCH /reels/:id/decision        → approve/reject the idea
  POST  /reels/:id/render          → (worker mock only)
  PATCH /reels/:id/video-decision  → accept/reject rendered video
  GET  /reels/:key      → serve MP4 from R2 (byte-range aware)
        │
        ▼
reel watch --execute   (Rust daemon, reel/src/watcher.rs; polls /reels?status=approved every 30s)
   for each reel where renderJobId == null && variants == []:
        spawn  node scripts/render-pro.js <reelId>     (serial, one at a time)
        │
        ▼
render-pro.js   (the heavy renderer, ~1680 LOC)
   fetch reel record from worker
   Chrome CDP scroll-tour + live screencast of the product URL  (cdp-capture.js)
   Edge TTS voiceover (uvx) → SRT-synced burned-in captions
   ffmpeg: scene cards, Ken Burns, xfade stitch, ambient bed, SFX
   npx wrangler r2 object put <bucket>/<key>  → upload MP4
   PATCH the reel record on the worker with variant asset URLs
```

This is the most-developed, real path. `render-pro.js` is self-contained; the
glue around it is now the Rust watcher (`reel/src/watcher.rs`, the spawn loop)
and `config/project-urls.json` loading.

### 2. Marketing autopilot flow — SaaS Maker queue driven

```
SaaS Maker Marketing Queue (reel/src/saas_maker.rs)
        │  accepted reel-channel item
        ▼
reel autopilot (reel/src/autopilot.rs → marketing.rs::render_accepted_marketing_posts)
   auto-accept aged intake → render accepted posts
        │
        ▼
VideoBrief contract (reel/src/brief.rs)  ── normalize + validate
        │
   create_renderer(mode) (reel/src/engine/factory.rs):
     mock              → MockEngine           (placeholder, tests)
     stock/moneyprinterturbo → MoneyPrinterEngine (HTTP API, real MP4)
     grok-video        → GrokVideoEngine      (approved local MP4 copy)
     ascii             → AsciiAnimationEngine (node scripts/render-ascii-animation.js)
     html-composition  → HtmlCompositionEngine (node scripts/export-html-composition.js)
     remotion/reel-maker     → ReelMakerEngine (node scripts/render-reel-maker.js)
        │
        ▼
   per-variant: build_variant_plan (reel/src/templates.rs) → render
                → R2Publisher (reel/src/publisher.rs, R2 via `wrangler r2 object put`)
                → score_variant (reel/src/quality.rs) → gate
        │
        ▼
   SaaSMakerClient patches the marketing post (reel/src/saas_maker.rs; asset_url, result_url, notes)
        │
        ▼
   post_ready_marketing_videos (reel/src/marketing_posting.rs) — gated handoff, default manual
```

Default `REEL_RENDER_MODE` is `mock`. The supported mode and alias matrix is
`config/render-modes.json`. The autopilot can post to YouTube/Instagram only
when a real provider reports success.

### Which engines are actually used

- **MoneyPrinterTurbo** — implemented HTTP adapter, real MP4 upload verified.
  Used by the autopilot `stock` mode via `MoneyPrinterEngine`.
- **reel-maker** — Remotion shell-out adapter, the `remotion` mode
  (`ReelMakerEngine`). Kept as a reference engine; lower priority than
  render-pro.
- **Grok local MP4s / ASCII / HTML composition** — local/no-credential modes
  used for approved assets, stylized MP4s, and reviewable preview artifacts.
- **OpenShorts** — removed from the active renderer factory; the submodule is
  parked as a reference only and remains a dedicated cleanup item.
- **render-pro.js** — not exposed through the Rust engine factory; it is its own
  production renderer driven by the watcher. **The Rust CLI drives it via
  `RenderProEngine`.**

## Rust crate layout (`reel/`)

A single cargo crate (`reel`) with a binary + library. Pure logic is ported in
full and unit-tested; heavy work is behind traits.

| Module | Ports / replaces | Notes |
| --- | --- | --- |
| `brief.rs` | `src/video-brief.js` | `VideoBrief` normalize + validate; `toMoneyPrinterRequest`. camelCase/snake_case accepted. |
| `templates.rs` | `src/reel-templates.js` | Template catalog, `selectTemplate`, `buildVariantPlan`, hook variants. |
| `quality.rs` | `src/reel-quality.js` | 7-dimension scoring + gate (`video_ready`/`needs_review`/`video_rejected`). |
| `config.rs` | `config/project-urls.json`, `src/config/social-accounts.js` | serde parsing; `*Env` keys resolved from the env (secrets never embedded). |
| `artifact.rs` | pure parts of `artifact-publisher.js` + `worker/index.js` | path classification, stable key naming, content-type, key safety, cache-buster URL. |
| `store.rs` | `src/job-store.js` | `ReelStore` trait + `FileJobStore` (JSON-per-job). R2 store deferred. |
| `runner.rs` | `execFile`/`spawn` wrappers | `CommandRunner` trait + `ProcessRunner` + recording fake for tests. |
| `engine/mod.rs` + `engine/factory.rs` | `createRenderer` contract (retired JS) | `RenderEngine` trait + `RenderResult`/`RenderOptions`; `create_renderer` mode dispatch. |
| `engine/render_pro.rs` | render-pro spawn glue (was `auto-render-watcher.js`) | shells out to `node scripts/render-pro.js <reelId>` with `REEL_VARIANT_COUNT`. |
| `engine/mock.rs` | `src/adapters/mock-renderer.js` | placeholder writer for tests/dry runs. |
| `publisher.rs` | R2 path of `artifact-publisher.js` | `ArtifactPublisher` trait + `R2Publisher` (`wrangler r2 object put`) + `NoopPublisher`. |
| `social.rs` | `src/posting.js` (gated) | `SocialPoster` trait + `DryRunPoster` (never posts). |
| `orchestrator.rs` | core loop of `src/pipeline.js` | `render_reel_variants`: plan → render → publish → score. |
| `saas_maker.rs` | `src/saas-maker-client.js` | `SaaSMakerClient` (`ureq` list/patch marketing posts) + `StubMarketingClient`. |
| `marketing.rs` | `renderAcceptedMarketingPosts` (was `src/pipeline.js`) | `render_accepted_marketing_posts`; artifact-publisher resolution. |
| `marketing_posting.rs` | `src/posting.js` | `post_ready_marketing_videos`; `ManualPoster`/`ChannelRoutingPoster` (YouTube + Instagram). |
| `marketing_metrics.rs` | posting metrics backfill | `sync_marketing_post_metrics` via `ChannelRoutingMetricsFetcher`. |
| `autopilot.rs` + `autopilot_daemon.rs` | `marketing-autopilot.js` (retired) | `run_autopilot_tick`: auto-accept aged intake → render → post; daemon loop. |
| `watcher.rs` | `auto-render-watcher.js` (retired) | `run_watch`: poll approved+unrendered reels, spawn render-pro serially. |
| `publishers/` | YouTube/Instagram upload | native `YouTubePublisher` + `InstagramPublisher`. |
| `cli.rs` + `main.rs` | `package.json` glue scripts | subcommands; live actions default to `--dry-run`. |

## Trait boundaries (the "heavy lifting stays out of Rust" rule)

```
RenderEngine        ── RenderProEngine  → node scripts/render-pro.js  (Chrome/ffmpeg/TTS/R2)
   │                   MockEngine       → local placeholder
ArtifactPublisher   ── R2Publisher      → npx wrangler r2 object put
   │                   NoopPublisher    → pass-through
MarketingPoster     ── ManualPoster           → marks prepared (safe default)
   │                   ChannelRoutingPoster  → native YouTube + Instagram
SocialPoster        ── DryRunPoster          → worker flow (unchanged)
CommandRunner       ── ProcessRunner    → std::process::Command
   │                   RecordingRunner  → test fake (asserts exact argv)
ReelStore           ── FileJobStore     → JSON file per job
MarketingClient     ── SaaSMakerClient  → ureq list/patch marketing posts
   │                   StubMarketingClient → fixture/tests
RenderEngine        ── MockEngine       → placeholder mp4
   │                   MoneyPrinterEngine → HTTP /api/v1/videos + poll
   │                   ReelMakerEngine    → node scripts/render-reel-maker.js
   │                   RenderProEngine    → node scripts/render-pro.js
```

Because every external effect is a `CommandRunner` call behind a trait, the
orchestration is fully unit-tested without Chrome/ffmpeg/network: tests assert
the exact `node`/`wrangler` argv that *would* run.

## CLI surface

```
reel render <reelId...> [--variant-count N] [--execute]   # production path; dry-run by default
reel watch [--worker-url URL] [--once] [--execute]        # auto-render-watcher equivalent
reel autopilot [--once] [--execute] [--fixture path]      # marketing-autopilot equivalent
reel render-accepted [--execute] [--fixture path] [--mode MODE] # render accepted marketing posts
reel post [--execute] [--posting-provider auto|manual]  # post ready marketing videos
reel metrics [--execute] [--fixture path]                 # backfill YouTube/Instagram post metrics
reel plan <brief.json> [--variant-count N]                # preview templates + hooks
reel validate-brief <brief.json>                          # VideoBrief lint
reel score <brief.json>                                   # quality heuristics
reel config <project-urls|social-accounts>                # inspect resolved config
```

`render`/`watch`/`autopilot`/`post` print intended actions unless `--execute` is passed.
Use `--posting-provider manual` for dry-run-style “prepared” outcomes without API calls.
Use `npm run check:generation-readiness -- --refresh --strict` to refresh the
required local/live proof set. Use `--fail-unresolved` for final target-host
acceptance; the generated report's `targetHostReady` field is the all-case
target-host signal.

## Safety properties preserved

- Submodules under `engines/` are never read, entered, or modified.
- Secrets are read from the environment only at runtime (`*Env` resolution);
  no token values are embedded or logged.
- `DryRunPoster` cannot post to YouTube/Instagram.
- Render/upload are shell-outs that default to dry-run in the CLI.
