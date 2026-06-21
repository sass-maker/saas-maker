# reel-pipeline — PROJECT STATUS

Last updated: 2026-06-20

## Why / What

Reel Pipeline turns approved reel drafts into rendered MP4s and posts them through the SaaS Maker marketing queue. Production render path:

`Worker (R2) → Rust watcher → node scripts/render-pro.js → R2 upload → worker patch`

**Users:** Marketing operators running autopilot/post flows; fleet integrators syncing SaaS Maker marketing queue; reviewers using swipe approve/reject UI.

**Constraints:** `render-pro.js` is canonical production renderer; Rust owns watch/autopilot/post entrypoints with JS glue retired. Hub-and-spoke: SaaS Maker is system of record.

**IN scope:** VideoBrief contract, MoneyPrinterTurbo + reel-maker adapters, R2 artifact Worker, Rust CLI orchestration, YouTube + Instagram Graph posting, product-proof Phase 1 quality gates.

**OUT of scope:** OpenShorts adapter (removed), Cloudflare Worker rewrite of orchestration, product-proof Phases 2–3 until Phase 1 stabilizes.

Marketing autopilot and posting run in Rust (`reel` CLI). Node remains for `render-pro.js`, OAuth bootstrap, and local dev server.

## Dependencies

### External

- **Cloudflare R2:** Production artifact storage (`reel-artifacts`).
- **MoneyPrinterTurbo:** `engines/MoneyPrinterTurbo` — default renderer (Python/FFmpeg).
- **reel-maker:** `engines/reel-maker` — Remotion prototype behind VideoBrief adapter.
- **YouTube Data API:** OAuth bootstrap `npm run yt:bootstrap`.
- **Instagram Graph API:** OAuth bootstrap + token refresh (`npm run ig:bootstrap` / `ig:refresh`).
- **Env:** `.env.example` — default API URL corrected to `api.sassmaker.com` (double-s brand).

### Internal (fleet)

| System | Role |
| --- | --- |
| **SaaS Maker** | System of record for marketing queue; pull accepted reel items; patch `asset_url`, `result_url`, provider metadata, posting state |
| **High Signal** | Reel brief intake via `src/signal-intake.js` |

### Stack & commands

**Stack:** Rust `reel/` crate (75 tests) · Node.js control scripts · Vitest via `node --test` · Worker `reel-pipeline-artifacts` · R2 `reel-artifacts` · MoneyPrinterTurbo · reel-maker · SaaS Maker client · YouTube + Instagram Graph publishers · review UI `src/review-ui.js`.

| Command | Purpose |
| --- | --- |
| `npm install` / `npm test` | Install + node --test + cargo test |
| `npm run dev` | Local control API |
| `npm run watch:render` | Production watcher (`reel watch --execute`) |
| `npm run watch:render:once` / `:dry` | One-shot / dry-run watcher |
| `npm run autopilot` / `:once` / `:dry` | Marketing autopilot intake → render → post |
| `npm run render:pro` | Canonical production render (`node scripts/render-pro.js`) |
| `npm run render:pro:rs` / `render:accepted` | Rust render paths |
| `npm run post:ready` | Post ready reels |
| `npm run yt:bootstrap` / `ig:bootstrap` / `ig:refresh` | OAuth bootstrap + token refresh |
| `npm run sync:saasmaker` / `draft:signal` | SaaS Maker sync & drafts |
| `npm run smoke:mock` / `smoke:reel-maker` / `smoke:artifact` / `smoke:full` | Smokes |
| `npm run bootstrap:cloudflare` / `check:cloudflare` / `worker:dry-run` | Cloudflare setup |
| `npm run lesson:render -- --input test/fixtures/lessons/closures.json --auto-approve` | Tutoring lesson pipeline |

**Entrypoints:** `src/worker/index.js` · `src/video-brief.js` · `src/saas-maker-client.js` · `reel/src/saas_maker.rs` · `reel/src/publishers/`.

## Timeline

- **2026-06-20 — Product-proof Phase 1 shipped:** Playwright screenshot capture (`src/product-proof-capture.js`); quality gate scoring (`src/reel-quality.js`); reel-maker composition with proof visuals; auto-wired via `resolveProductProofCapture()` in `src/pipeline.js`; review UI surfaces quality dimensions; smoke at `npm run smoke:reel-maker`.
- **2026-06-20 — SaaS Maker hostname fix:** Default API URL and `.env.example` corrected to `api.sassmaker.com` (double-s brand).
- **Rust orchestrator cutover:** All entrypoints on Rust CLI; JS watcher/autopilot/post glue retired with parity validated (`validate-watcher-parity.mjs`).

## Products

| Surface | URL |
| --- | --- |
| Artifact Worker base | `https://reel-pipeline-artifacts.sarthakagrawal927.workers.dev` |
| Health | `GET /health` |
| MP4 artifacts | `GET /reels/:key` (byte-range enabled) |
| SaaS Maker API (default) | `https://api.sassmaker.com` |

## Features (shipped)

### Architecture

- SaaS Maker Marketing Queue (`/v1/marketing/posts`) supplies accepted items; pipeline PATCHes `asset_url`, `result_url`, status back.
- VideoBrief contract (`src/video-brief.js`) feeds mock, MoneyPrinterTurbo (default stock-footage MP4s), or reel-maker (+ product-proof capture) adapters.
- Render path: `render-pro.js` / Rust `reel render` → local MP4 → artifact publisher → R2 `reel-artifacts`.
- Cloudflare Worker `reel-pipeline-artifacts` serves MP4 with byte-range support at `/reels/:key`.
- Rust autopilot/post publishes to YouTube + Instagram Graph, then PATCHes marketing queue.
- Rust crate (`reel/`) owns watch, render-accepted, autopilot, and post entrypoints; JS control layer retired for watcher/autopilot/post glue with parity validated.
- Intake `POST /reels`, review UI `GET /review`, render `POST /reels/:id/render`, video decision APIs in Node control layer.
- OpenShorts removed from pipeline; submodule still present in repo.

### Core pipeline

- VideoBrief contract; mock/MoneyPrinterTurbo/reel-maker adapters; SaaS Maker sync.
- Intake `POST /reels`, review UI `GET /review`, render `POST /reels/:id/render`, video decision APIs.
- Artifact publisher (local + R2); Worker serves MP4 with byte-range.

### Rust orchestrator

- All entrypoints on Rust CLI; JS watcher/autopilot/post glue retired with parity validated (`validate-watcher-parity.mjs`).
- Production watcher: `npm run watch:render` → `reel watch --execute`.
- Marketing autopilot: intake → render → post in Rust (`npm run autopilot`).

### Native social posting

- YouTube + Instagram Graph publishers in `reel/src/publishers/`.

### OpenShorts removal

- Adapter deleted from pipeline; submodule parked (still present in repo — explicit approval needed to remove).

### Product-proof Phase 1 (2026-06-20)

- Playwright screenshot capture (`src/product-proof-capture.js`).
- Quality gate scoring (`src/reel-quality.js`): `productProofStrength`, `valueClarity`, `visualTrust`, `captionReadability`, `mobileComposition`, `cringeRisk`, `postingReadiness`.
- reel-maker composition with proof visuals; auto-wired via `resolveProductProofCapture()` in `src/pipeline.js`.
- Review UI surfaces quality dimensions; smoke at `npm run smoke:reel-maker`.

## Todo / Planned / Deferred / Blocked

### Planned

1. Merge `opt/rust-rewrite` PR + staging sign-off on live renders.
2. Phase 2 screen-recording renderer (`demoSteps` browser flow with screenshot fallback).
3. Phase 3 multi-variant render (`variantCount` > 1) polish in review UI.
4. Wire draft bundle output into review UI without paid engines.

### Deferred

- Remove `engines/openshorts` git submodule (explicit approval).
- Cloudflare Worker rewrite of orchestration (stay on JS + Rust CLI).
- reel-maker / Remotion path (`render-pro` is canonical production renderer).
- Product-proof Phases 2–3 (screen recording, multi-variant drafts).
- Phase 2–3 product-proof PRD work not started.
- OpenShorts submodule still present though adapter removed.
- Draft bundle output not yet wired into review UI.

### Blocked

- `opt/rust-rewrite` PR not yet merged; staging sign-off on live renders pending.
