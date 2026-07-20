# Architecture

Reel Pipeline is the video generation layer for the SaaS Maker Marketing Queue
and the anonymous brand-website-to-reel product. It does not replace SaaS Maker;
it turns accepted/generated marketing ideas and public brand URLs into
reviewable video drafts, rendered MP4s, and gated posting handoff.

For the Rust orchestrator internals (crate layout, trait boundaries, CLI
surface), see [`rust-orchestrator.md`](./rust-orchestrator.md). For render
engines, see [`engines.md`](./engines.md). For the operator-facing render-mode
matrix, see [`render-modes.md`](./render-modes.md).

## Control plane

SaaS Maker remains the source of truth for marketing ideas, approval state, and
task linkage. Significant Hobbies remains the source of truth for canonical
article claims and creative approval. Reel Pipeline owns media production and
posting adapters; it does not become the source of product claims.

```text
SaaS Maker Marketing Queue  ─┐
High Signal reel briefs      ─┼─> VideoBrief contract ─> render ─> artifact ─> review ─> post
Significant Hobbies          ─┤                              │
SWE Interview Prep           ─┤                              └─> distribution approval ─> channel account
Project campaigns            ─┘
```

Approval gates, in order:

1. Agent creates a Marketing Queue item (or a public brand URL is submitted
   anonymously).
2. Operator accepts or rejects the item.
3. `reel-pipeline` converts an accepted item into a `VideoBrief`.
4. A render adapter creates a draft video (one or more variants).
5. MP4, thumbnail, captions, logs, and provider metadata attach back to the
   queue item.
6. Autopost runs only after explicit acceptance/scheduling and a successful
   provider response.

## Two non-overlapping flows

### 1. Worker reel flow — the ONE production render path

```text
Cloudflare Worker (src/worker/index.js, R2ReelStore)
  POST /reels[/signal]  → store reel draft in R2
  GET  /review          → swipe review UI (src/review-ui.js)
  PATCH /reels/:id/decision        → approve/reject the idea
  POST  /reels/:id/render          → (worker mock only)
  PATCH /reels/:id/video-decision  → accept/reject rendered video
  GET  /reels/:key      → serve MP4 from R2 (byte-range aware)
        │
        ▼
Rust watcher  (`reel watch --execute`, reel/src/watcher.rs; polls /reels?status=approved every 30s)
   for each reel where renderJobId == null && variants == []:
        spawn  node scripts/render-pro.js <reelId>     (serial, one at a time)
        │
        ▼
render-pro.js   (canonical production renderer, ~1680 LOC)
   fetch reel record from worker
   Chrome CDP scroll-tour + live screencast of the product URL  (cdp-capture.js)
   Edge TTS voiceover (uvx) → SRT-synced burned-in captions
   ffmpeg: scene cards, Ken Burns, xfade stitch, ambient bed, SFX
   npx wrangler r2 object put <bucket>/<key>  → upload MP4
   PATCH the reel record on the worker with variant asset URLs
```

`render-pro.js` is self-contained; the orchestration around it is the Rust
watcher and `config/project-urls.json` loading.

### 2. Marketing autopilot flow — SaaS Maker queue driven

```text
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
     stock/moneyprinterturbo → MoneyPrinterEngine (HTTP API → src/adapters/moneyprinterturbo.js path, real MP4)
     grok-video        → GrokVideoEngine      (approved local MP4 copy)
     ascii             → AsciiAnimationEngine (node scripts/render-ascii-animation.js)
     html-composition  → HtmlCompositionEngine (node scripts/export-html-composition.js)
     remotion/reel-maker     → ReelMakerEngine (node scripts/render-reel-maker.js)
        │
        ▼
   per-variant: build_variant_plan (reel/src/templates.rs) → render
                → publisher.rs R2Publisher (R2 via `wrangler r2 object put`)
                → score_variant (reel/src/quality.rs) → gate
        │
        ▼
   SaaSMakerClient patches the marketing post (reel/src/saas_maker.rs; asset_url, result_url, notes)
        │
        ▼
   post_ready_marketing_videos (reel/src/marketing_posting.rs) — gated handoff
```

Default `REEL_RENDER_MODE` is `mock`. The supported mode and alias matrix is
`config/render-modes.json` (see [`render-modes.md`](./render-modes.md)). The
autopilot can post to YouTube/Instagram only when a real provider reports
success.

## Core modules

| Module | Role |
| --- | --- |
| `src/video-brief.js` / `reel/src/brief.rs` | normalize + validate queue items into a `VideoBrief`; `toMoneyPrinterRequest` |
| `src/signal-intake.js` | map High Signal reel briefs and SaaS Maker improvement ideas into `VideoBrief` drafts |
| `src/signal-draft-generator.js` | prototype multi-variant draft bundles with claim/evidence review |
| `src/reel-intake.js` | create API-submitted reel drafts; record approval decisions |
| `src/review-ui.js` | plain HTML/CSS/JS swipe review UI |
| `src/pipeline.js` | JS render orchestration (`createRenderer`/`renderReelVariants`/`renderAcceptedMarketingPosts`) retained for the local dev server (`src/server/index.js`) and the studio / anonymous / significant-content surfaces; the production marketing autopilot and watcher run in Rust (`reel/`) |
| `reel/src/orchestrator.rs` | Rust render orchestration loop (`render_reel_variants`) driving the production autopilot + watcher paths |
| `src/adapters/*` | one adapter per render engine (see [`engines.md`](./engines.md)) |
| `src/artifact-publisher.js` / `reel/src/publisher.rs` | local + R2 artifact publishing |
| `src/posting.js` / `reel/src/marketing_posting.rs` | gated posting handoff + provider abstraction |
| `src/reel-quality.js` / `reel/src/quality.rs` | 7-dimension quality scoring + gate |
| `src/reel-self-review.js` | post-render `ffprobe` self-review of the actual file |
| `src/worker/index.js` | Cloudflare Worker serving R2 MP4 artifacts (byte-range) |
| `src/anonymous-video/*` | anonymous brand-website-to-reel intake, brief, renderer, presenter library |

## Safety properties

- Submodules under `engines/` are never read, entered, or modified by the
  orchestrator; engines are called through adapters.
- Secrets are read from the environment only at runtime (`*Env` resolution);
  no token values are embedded or logged.
- `DryRunPoster` cannot post to YouTube/Instagram; live actions default to
  `--dry-run` in the Rust CLI.
- Render/upload are shell-outs that default to dry-run unless `--execute` is
  passed.
- Autopost requires an accepted queue item and a successful provider response;
  manual posting records `prepared`, never `posted`.
- The anonymous brand-reel surface has no auth, billing, workspaces, actor
  marketplace, payouts, social posting, or scheduling (see
  [`decisions/0005-anonymous-no-auth-product-boundary.md`](./decisions/0005-anonymous-no-auth-product-boundary.md)).
