# Rust orchestrator architecture (`reel/`)

This document maps the existing Node flow and the Phase 1 Rust rewrite that
replaces the Node *glue*. It does NOT touch the git submodules under `engines/`,
and it does not reimplement ffmpeg, Chrome capture, TTS, or the render engines —
those stay behind trait interfaces with one shell-out impl.

## The two real flows in the JS

The pipeline has two non-overlapping orchestration flows (the README and
`scripts/marketing-autopilot.js` header confirm this):

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
auto-render-watcher.js   (daemon, polls /reels?status=approved every 30s)
   for each reel where renderJobId == null && variants == []:
        spawn  node scripts/render-pro.js <reelId>     (serial, one at a time)
        │
        ▼
render-pro.js   (the heavy renderer, ~1600 LOC)
   fetch reel record from worker
   Chrome CDP scroll-tour + live screencast of the product URL  (cdp-capture.js)
   Edge TTS voiceover (uvx) → SRT-synced burned-in captions
   ffmpeg: scene cards, Ken Burns, xfade stitch, ambient bed, SFX
   npx wrangler r2 object put <bucket>/<key>  → upload MP4
   PATCH the reel record on the worker with variant asset URLs
```

This is the most-developed, real path. `render-pro.js` is self-contained;
the Node "glue" around it is just `auto-render-watcher.js` (the spawn loop) and
`config/project-urls.json` loading.

### 2. Marketing autopilot flow — SaaS Maker queue driven

```
SaaS Maker Marketing Queue (saas-maker-client.js)
        │  accepted reel-channel item
        ▼
marketing-autopilot.js → src/autopilot.js (runAutopilotTick)
   auto-accept aged intake → renderAcceptedMarketingPosts (src/pipeline.js)
        │
        ▼
VideoBrief contract (src/video-brief.js)  ── normalize + validate
        │
   createRenderer(mode):
     mock              → MockRenderer            (placeholder, tests)
     stock/moneyprinterturbo → MoneyPrinterTurboAdapter (HTTP API, real MP4)
     openshorts/ugc_actor    → OpenShortsAdapter (job-spec STUB, unused)
     remotion/reel-maker     → ReelMakerAdapter  (Remotion shell-out)
        │
        ▼
   per-variant: buildVariantPlan (reel-templates.js) → render
                → publishRenderArtifacts (R2 via wrangler, artifact-publisher.js)
                → scoreVariant (reel-quality.js) → gate
        │
        ▼
   SaaSMakerClient.updateMarketingPost  (asset_url, result_url, notes)
        │
        ▼
   postReadyMarketingVideos (posting.js) — gated handoff, default mock
```

Default `REEL_RENDER_MODE` is `mock`. The autopilot can post to
YouTube/Instagram only when a real provider reports success.

### Which engines are actually used

- **MoneyPrinterTurbo** — implemented HTTP adapter, real MP4 upload verified.
  Used by the autopilot `stock` mode. Kept; ported in a later phase.
- **reel-maker** — Remotion shell-out adapter, the `remotion` mode. Kept as a
  reference engine; lower priority than render-pro.
- **OpenShorts** — guarded **stub**: it only writes a `job.json` spec and never
  invokes paid UGC deps. Effectively unused. **Drop candidate** (PLAN.md).
- **render-pro.js** — not exposed through `createRenderer`; it is its own
  production renderer driven by the watcher. **This is the path the Rust CLI
  replaces first.**

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
| `engine/mod.rs` | `createRenderer` contract | `RenderEngine` trait + `RenderResult`/`RenderOptions`. |
| `engine/render_pro.rs` | `auto-render-watcher.js` spawn glue | shells out to `node scripts/render-pro.js <reelId>` with `REEL_VARIANT_COUNT`. |
| `engine/mock.rs` | `src/adapters/mock-renderer.js` | placeholder writer for tests/dry runs. |
| `publisher.rs` | R2 path of `artifact-publisher.js` | `ArtifactPublisher` trait + `R2Publisher` (`wrangler r2 object put`) + `NoopPublisher`. |
| `social.rs` | `src/posting.js` (gated) | `SocialPoster` trait + `DryRunPoster` (never posts in Phase 1). |
| `orchestrator.rs` | core loop of `src/pipeline.js` | `render_reel_variants`: plan → render → publish → score. |
| `cli.rs` + `main.rs` | `package.json` glue scripts | subcommands; live actions default to `--dry-run`. |

## Trait boundaries (the "heavy lifting stays out of Rust" rule)

```
RenderEngine        ── RenderProEngine  → node scripts/render-pro.js  (Chrome/ffmpeg/TTS/R2)
   │                   MockEngine       → local placeholder
ArtifactPublisher   ── R2Publisher      → npx wrangler r2 object put
   │                   NoopPublisher    → pass-through
SocialPoster        ── DryRunPoster     → records intent, never posts
CommandRunner       ── ProcessRunner    → std::process::Command
   │                   RecordingRunner  → test fake (asserts exact argv)
ReelStore           ── FileJobStore     → JSON file per job
```

Because every external effect is a `CommandRunner` call behind a trait, the
orchestration is fully unit-tested without Chrome/ffmpeg/network: tests assert
the exact `node`/`wrangler` argv that *would* run.

## CLI surface

```
reel render <reelId...> [--variant-count N] [--execute]   # production path; dry-run by default
reel watch [--worker-url URL] [--once]                    # auto-render-watcher equivalent (dry-run scaffold)
reel plan <brief.json> [--variant-count N]                # preview templates + hooks
reel validate-brief <brief.json>                          # VideoBrief lint
reel score <brief.json>                                   # quality heuristics
reel config <project-urls|social-accounts>                # inspect resolved config
```

`render`/`watch` print the exact command they would run unless `--execute` is
passed, so the binary is safe to run with no render environment and never
performs a live render or post in Phase 1.

## Safety properties preserved

- Submodules under `engines/` are never read, entered, or modified.
- Secrets are read from the environment only at runtime (`*Env` resolution);
  no token values are embedded or logged.
- `DryRunPoster` cannot post to YouTube/Instagram.
- Render/upload are shell-outs that default to dry-run in the CLI.
