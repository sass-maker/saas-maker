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

## Phase 2 — production render cutover (`render-pro` path)

Make the Rust CLI the real driver of the worker reel flow, replacing
`auto-render-watcher.js`.

- [ ] HTTP client (add `reqwest` or `ureq`) to:
  - `GET {worker}/reels?status=approved`
  - filter `renderJobId == null && variants == []` (port `needsRender`)
- [ ] Implement `reel watch --execute`: serial render loop, one reel at a time,
      SIGINT-drains-current-render semantics (port the watcher's signal handling).
- [ ] Implement `reel render --execute` against `RenderProEngine` + `ProcessRunner`
      (already builds the correct command; just flip execution on).
- [ ] Side-by-side validation: run Rust watcher and JS watcher against the same
      worker in a staging bucket; diff produced asset URLs + reel-record patches.
- [ ] Cutover: switch the deployed watcher invocation to the `reel` binary.
      Keep `auto-render-watcher.js` as fallback for one release.

## Phase 3 — autopilot / SaaS Maker flow

Port the marketing-queue flow (`autopilot.js` + `pipeline.js` + clients).

- [ ] `SaaSMakerClient` (list/patch marketing posts) — needs HTTP client + the
      `SAASMAKER_SESSION_TOKEN` env (read-only at runtime).
- [ ] `briefFromMarketingPost`, `renderPatchForMarketingPost`.
- [ ] `MoneyPrinterTurboAdapter` as a second `RenderEngine` impl (HTTP POST to
      `/api/v1/videos`, poll `/api/v1/tasks/:id`). `toMoneyPrinterRequest` is
      already ported.
- [ ] `runAutopilotTick`: auto-accept aged intake, render accepted, post ready.
- [ ] Wire `R2Publisher` + a real `SocialPoster` (see Phase 4) into the tick.

## Phase 4 — social posting (currently `DryRunPoster` only)

- [ ] YouTube publisher (`src/publishers/youtube.js`) behind `SocialPoster`.
- [ ] Instagram publisher (`src/publishers/instagram.js`) behind `SocialPoster`.
- [ ] Keep the gate: a post is only marked sent when the provider reports
      success. OAuth/token refresh remains out of the Rust crate's secret scope
      (read tokens from env / existing bootstrap output only).

## Phase 5 — the Cloudflare Worker

The Worker (`src/worker/index.js`) runs on Cloudflare's JS/WASM runtime; a Rust
rewrite would target `workers-rs` (WASM). Lower priority — it is stable and
small. Options, in order of preference:

1. Leave the Worker in JS (it is the one piece that genuinely belongs on the
   edge runtime); share only the artifact key/content-type/range logic via a
   spec doc. The Rust `artifact.rs` already mirrors `isSafeKey`/`contentTypeFor`.
2. If a rewrite is wanted: `workers-rs` + the R2 binding; port the route table
   and the byte-range `serveArtifact` logic (the trickiest part — 206/416
   handling is already documented in the JS).

## Phase 6 — retire JS + drop unused engines

After Phases 2–4 reach parity and bake in production:

- [ ] Remove the ported JS glue scripts (`auto-render-watcher.js`,
      `marketing-autopilot.js`, `src/pipeline.js`, `src/autopilot.js`, adapters)
      once their Rust equivalents are the deployed path. Keep `render-pro.js`
      itself (Rust orchestrates it; it is not reimplemented).
- [ ] **Drop the 2 unused engines**:
  - `engines/openshorts` — only the guarded job-spec stub uses it; no paid UGC
    path was ever wired. Remove the submodule (`git rm` the submodule + its
    `.gitmodules` entry) and delete `src/adapters/openshorts.js`.
  - `engines/reel-maker` — if render-pro fully supersedes the Remotion path,
    drop the submodule + `src/adapters/reel-maker.js`. If the Remotion templates
    are still wanted, port `ReelMakerAdapter` as a third `RenderEngine` first.
  - Keep `engines/MoneyPrinterTurbo` (real `stock` renderer, Phase 3).
  - NOTE: dropping submodules is a destructive history change — do it in a
    dedicated PR, never as part of the rewrite branch, and only on explicit
    approval.

## Risks / open questions

- `render-pro.js` writes the reel-record patch itself; the Rust watcher only
  needs exit-code + the worker as source of truth. If we later want richer
  result data in Rust, render-pro would need a `--json` output mode.
- Timestamp format in `FileJobStore` is a sortable placeholder (`@<secs>`), not
  a real ISO-8601 string. If the JS store and Rust store must interoperate on
  the same dir, switch to a real RFC3339 timestamp (add `time`/`chrono`).
- HTTP client choice (`reqwest` pulls tokio + TLS; `ureq` is lighter/blocking).
  The orchestration is currently synchronous, so `ureq` likely fits better.
