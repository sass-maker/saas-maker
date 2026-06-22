# Rust rewrite — phased plan

The Node implementation stays fully in place and untouched until parity is
reached. The Rust crate lives in `reel/` and is additive. This plan tracks what
is ported, what remains, and the cutover.

## Phase 1 — orchestration core (DONE)

Goal: a compiling, tested Rust crate that owns the pure orchestration logic and
the engine/publisher/poster trait boundaries, with one shell-out impl each.

Ported + unit tested:

- [x] `VideoBrief` normalize + validate (`brief.rs`) — channels, proof types,
      render modes, duration bounds, reel-body shape, camel/snake keys,
      `toMoneyPrinterRequest`.
- [x] Template selection + variant planning + hook variants (`templates.rs`).
- [x] Quality scoring + gate (`quality.rs`), 7 dimensions, fatal-issue gating.
- [x] Config: `project-urls.json` + social-accounts `*Env` resolution + account
      routing (`config.rs`).
- [x] Artifact path/key/content-type/safety/cache-buster helpers (`artifact.rs`).
- [x] `FileJobStore` (`store.rs`).
- [x] Trait interfaces: `RenderEngine`, `ArtifactPublisher`, `SocialPoster`,
      `CommandRunner`, `ReelStore`.
- [x] One concrete impl each: `RenderProEngine` (→ `node scripts/render-pro.js`),
      `MockEngine`, `R2Publisher` (→ `wrangler r2 object put`), `NoopPublisher`,
      `DryRunPoster`, `ProcessRunner`.
- [x] `render_reel_variants` orchestration loop (`orchestrator.rs`).
- [x] CLI: `render`, `watch`, `plan`, `validate-brief`, `score`, `config`.

Verification: `cargo build`, `cargo check`, `cargo test` all green
(55 unit + 3 integration tests). CLI smoke-tested against real
`config/project-urls.json` and a fixture brief.

Explicitly NOT done in Phase 1 (by design): live render, live R2 upload, live
polling loop, any social post. `render`/`watch` are dry-run by default.

## Phase 2 — production render cutover (`render-pro` path) (DONE)

Make the Rust CLI the real driver of the worker reel flow, replacing
`auto-render-watcher.js`.

- [x] HTTP client (`ureq`) to:
  - `GET {worker}/reels?status=approved`
  - filter `renderJobId == null && variants == []` (port `needsRender`)
- [x] Implement `reel watch --execute`: serial render loop, one reel at a time,
      SIGINT-drains-current-render semantics (port the watcher's signal handling).
- [x] Implement `reel render --execute` against `RenderProEngine` + `ProcessRunner`
      (already builds the correct command; just flip execution on).
- [x] Side-by-side validation script: `npm run validate:watcher` compares JS vs Rust
      candidate selection against the live worker (dry-run).
- [ ] Staging bucket diff of produced asset URLs + reel-record patches (manual sign-off).
- [x] Cutover: `npm run watch:render` invokes the Rust CLI.
      JS watcher kept as fallback (`watch:render:js`).

## Phase 3 — autopilot / SaaS Maker flow (DONE)

Port the marketing-queue flow (`autopilot.js` + `pipeline.js` + clients).

- [x] `SaaSMakerClient` (list/patch marketing posts) via `ureq` +
      `SAASMAKER_SESSION_TOKEN`.
- [x] `briefFromMarketingPost`, `renderPatchForMarketingPost`.
- [x] `MoneyPrinterTurboAdapter` as a second `RenderEngine` impl (HTTP POST to
      `/api/v1/videos`, poll `/api/v1/tasks/:id`).
- [x] `runAutopilotTick`: auto-accept aged intake, render accepted, post ready.
- [x] `R2Publisher` wired into the render phase when `REEL_ARTIFACT_R2_BUCKET` is set.

## Phase 4 — social posting (DONE)

- [x] Posting gate + `postReadyMarketingVideos` in Rust (`marketing_posting.rs`).
- [x] Native `YouTubePublisher` (OAuth refresh + resumable upload).
- [x] Native `InstagramPublisher` (container create → poll → publish).
- [x] `ChannelRoutingPoster` routes by channel + `config/social-accounts.json`.
- [x] CLI: `reel post --execute` (`npm run post:ready`).

## Phase 6 — retire JS glue (DONE for orchestration scripts)

- [x] Deleted superseded JS scripts (watcher, autopilot, render-accepted, post-ready).
- [x] Removed OpenShorts adapter (`openshorts`/`ugc_actor` render modes throw).
- [ ] Drop `engines/openshorts` git submodule (submodule dir still present; delete in dedicated PR).
- [ ] Drop `engines/reel-maker` if render-pro fully supersedes Remotion (unchanged).

The Worker (`src/worker/index.js`) runs on Cloudflare's JS/WASM runtime; a Rust
rewrite would target `workers-rs` (WASM). Lower priority — it is stable and
small. Options, in order of preference:

1. Leave the Worker in JS (it is the one piece that genuinely belongs on the
   edge runtime); share only the artifact key/content-type/range logic via a
   spec doc. The Rust `artifact.rs` already mirrors `isSafeKey`/`contentTypeFor`.
2. If a rewrite is wanted: `workers-rs` + the R2 binding; port the route table
   and the byte-range `serveArtifact` logic (the trickiest part — 206/416
   handling is already documented in the JS).

## Phase 6 — retire JS + drop unused engines (PARTIAL)

- [x] Deleted orchestration glue scripts (watcher, autopilot, render-accepted, post-ready).
- [x] Removed OpenShorts adapter; `openshorts`/`ugc_actor` modes throw.
- [x] Kept `render-pro.js`, OAuth bootstrap scripts, and `src/server` dev harness.
- [ ] Drop `engines/openshorts` git submodule (directory still present).
- [ ] Drop `engines/reel-maker` if render-pro fully supersedes Remotion.

## Risks / open questions

- `render-pro.js` writes the reel-record patch itself; the Rust watcher only
  needs exit-code + the worker as source of truth. If we later want richer
  result data in Rust, render-pro would need a `--json` output mode.
- Timestamp format in `FileJobStore` is a sortable placeholder (`@<secs>`), not
  a real ISO-8601 string. If the JS store and Rust store must interoperate on
  the same dir, switch to a real RFC3339 timestamp (add `time`/`chrono`).
- HTTP client choice (`reqwest` pulls tokio + TLS; `ureq` is lighter/blocking).
  The orchestration is currently synchronous, so `ureq` likely fits better.
