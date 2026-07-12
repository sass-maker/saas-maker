# reel-pipeline — PROJECT STATUS

Last updated: 2026-07-12

## Why / What

Reel Pipeline turns approved reel drafts into rendered MP4s and posts them through the SaaS Maker marketing queue. Production render path:

`Worker (R2) → Rust watcher → node scripts/render-pro.js → R2 upload → worker patch`

**Users:** Marketing operators running autopilot/post flows; fleet integrators syncing SaaS Maker marketing queue; reviewers using swipe approve/reject UI.

**Constraints:** `render-pro.js` is canonical production renderer; Rust owns watch/autopilot/post entrypoints with JS glue retired. Hub-and-spoke: SaaS Maker is system of record.

**Creator validation constraint:** for kids story reels, the next step is a
manual creator MVP, not more pipeline software. Use `docs/creator-mvp.md` to
make the first three public-domain story videos by hand before adding new
automation, dashboards, agents, auto-uploaders, or render engines for that bet.

**Growth format constraint:** for app marketing reels, the objective is to find
a format that gets views consistently. Use `docs/growth-format-playbook.md` and
the structured `src/growth-formats.js` taxonomy to draft 5-7 posts/day until
the 35-post decision review.

**IN scope:** VideoBrief contract, MoneyPrinterTurbo + reel-maker adapters, R2 artifact Worker, Rust CLI orchestration, YouTube + Instagram Graph posting, product-proof Phase 1 quality gates, and lightweight draft/export support for the creator MVP.

**OUT of scope:** OpenShorts adapter (removed), Cloudflare Worker rewrite of orchestration, product-proof Phases 2–3 until Phase 1 stabilizes, and kids-story automation before the first three manual videos prove the format.

Marketing autopilot and posting run in Rust (`reel` CLI). Node remains for `render-pro.js`, OAuth bootstrap, and local dev server.

## Dependencies

### External

- **Cloudflare R2:** Production artifact storage (`reel-artifacts`).
- **MoneyPrinterTurbo:** `engines/MoneyPrinterTurbo` — default renderer (Python/FFmpeg).
- **Grok / Imagine local MP4s:** `GROK_VIDEO_ASSET_DIR` — curated local export
  folder for pre-rendered Grok clips used as optional motion inserts or
  standalone `grok-video` renders; no Grok credentials or API calls in repo.
- **reel-maker:** `engines/reel-maker` — Remotion prototype behind VideoBrief adapter.
- **YouTube Data API:** OAuth bootstrap `npm run yt:bootstrap`.
- **Instagram Graph API:** OAuth bootstrap + token refresh (`npm run ig:bootstrap` / `ig:refresh`).
- **Env:** `.env.example` — default API URL corrected to `api.sassmaker.com` (double-s brand).
- **Creator MVP tools (manual, not repo dependencies):** public-domain story
  sources, ChatGPT/Claude for rewrites, image generation, human or licensed TTS
  narration, DaVinci Resolve/CapCut, YouTube Audio Library, Canva, YouTube
  Studio.

### Internal (fleet)

| System | Role |
| --- | --- |
| **SaaS Maker** | System of record for marketing queue; pull accepted reel items; patch `asset_url`, `result_url`, provider metadata, posting state |
| **High Signal** | Reel brief intake via `src/signal-intake.js` |

### Stack & commands

**Stack:** Rust `reel/` crate · Node.js control scripts · Vitest via `node --test` · Worker `reel-pipeline-artifacts` · R2 `reel-artifacts` · MoneyPrinterTurbo · Grok local MP4 adapter · reel-maker · SaaS Maker client · YouTube + Instagram Graph publishers · review UI `src/review-ui.js`.

**Setup (fresh clone):** the render path shells out to `node scripts/render-pro.js`, which depends on the engine git submodules. Clone with `git clone --recurse-submodules`, or run `git submodule update --init --recursive` after cloning — otherwise render fails with missing `engines/*`.

| Command | Purpose |
| --- | --- |
| `npm install` / `npm test` | Install + node --test + cargo test |
| `npm run dev` | Local control API |
| `npm run watch:render` | Production watcher (`reel watch --execute`) |
| `npm run watch:render:once` / `:dry` | One-shot / dry-run watcher |
| `npm run autopilot` / `:once` / `:dry` | Marketing autopilot intake → render → post |
| `npm run render:pro` | Canonical production render (`node scripts/render-pro.js`) |
| `npm run moneyprinter:api` | Start MoneyPrinterTurbo API on `127.0.0.1:18080` for canaries |
| `npm run render:html -- --brief brief.json --artifact-dir artifacts/html` | Export Editframe-inspired HTML/CSS preview artifacts |
| `npm run render:pro:rs` / `render:accepted` | Rust render paths; supports `--mode moneyprinterturbo`, `grok-video`, `ascii`, `html-composition`, `reel-maker`, and `mock` |
| `npm run post:ready` | Post ready reels |
| `npm run yt:bootstrap` / `ig:bootstrap` / `ig:refresh` | OAuth bootstrap + token refresh |
| `npm run sync:saasmaker` / `draft:signal` | SaaS Maker sync & drafts |
| `npm run smoke:generation-cases` | Top-level readiness smoke for marketing render modes, Worker render-pro, lesson CLI, and creator packets |
| `npm run smoke:render-modes` | Fixture-backed readiness smoke for local/no-credential render modes |
| `npm run check:generation-readiness` / `-- --refresh --strict` | Consolidated current-evidence report / refreshed required-proof gate |
| `npm run ready:local` / `ready:proofs` / `ready:target` | One-command local smoke / refreshed proof / final target-host acceptance gates |
| `npm run smoke:mock` / `smoke:reel-maker` / `smoke:artifact` / `smoke:full` / `smoke:studio` | Smokes |
| `npm run studio -- <tool>` | Content studio: ideas, titles, descriptions, tags, scripts, brand voice, keywords, transcripts, thumbnails, ideas manager |
| `npm run dev` → `/studio` | Content studio web UI (all tools + ideas manager + faceless runs in the browser) |
| `npm run faceless -- --topic "..."` | Topic → script → brief → rendered faceless video (batch via `--topics-file`; engines mock/kokoro/moneyprinterturbo) |
| `npm run setup:kokoro` | One-time local Kokoro-82M TTS install (venv + ~340MB model) |
| `npm run factory -- plan/produce/status` | Backlog conveyor: plan ideas → produce renders with quality gate + publish packet |
| `npm run bootstrap:cloudflare` / `check:cloudflare` / `worker:dry-run` | Cloudflare setup |
| `npm run lesson:render -- --input test/fixtures/lessons/closures.json --auto-approve` | Tutoring lesson pipeline |

**Entrypoints:** `src/worker/index.js` · `src/video-brief.js` ·
`src/saas-maker-client.js` · `reel/src/saas_maker.rs` ·
`reel/src/publishers/`.

**Render mode matrix:** `config/render-modes.json` is the operator-facing list
of supported modes, aliases, provider names, smoke coverage, and live-service
requirements.

**Live readiness matrix:** `config/live-generation-readiness.json` maps local
smokes, live canaries, artifact playback, lesson prerequisites, posting
prerequisites, and manual creator review into one current-evidence report at
`tmp/generation-readiness/report.json`.
It also records the production `render-pro` live proof as a manual target-host
check because that run mutates a real Worker reel record and R2 object.

**Readiness checklist:** `docs/generation-readiness.md` defines the local and
live proof commands for render modes, lesson videos, artifact hosting, and
posting.
Use `npm run ready:target` for final target-host acceptance when manual and
missing checks must be closed.
The generated report separates `strictReady` from `targetHostReady`; only
`targetHostReady: true` means all target-host generation cases are closed or
explicitly accepted. When target-host readiness is false, `targetHostNextActions`
records the remaining proof commands and docs links.
Use `docs/target-host-readiness.md` for the evidence checklist behind those
unresolved target-host items, including the optional documented acceptance file
for intentional target-host exclusions.

## Timeline

- **2026-07-12 — Source-backed multi-brand marketing path:** added read-only
  extractors for High Signal, Significant Hobbies, and SWE Interview Prep;
  revisioned `fleet.content-package.v1` packages; per-brand visual/channel
  configuration; local Kokoro + Chromium + FFmpeg vertical video rendering;
  and a separate `fleet.distribution-request.v1` gate. Both Rust and Node
  time-based auto-accept paths are disabled. Live posting now fails closed
  until the exact brand/channel account is mapped and the distribution request
  is separately approved. See `docs/content-package-pipeline.md`.

- **2026-07-10 — Studio factory line shipped:** production conveyor over the
  ideas manager — `npm run factory` plan/produce/status; every render now
  gets a quality gate (`quality.json`, pass/review/fail across duration fit,
  resolution, audio, hook, pacing, captions) and a publish packet
  (`packet/upload.md` + thumbnail); `/studio` gains Factory panels and a
  Renders review panel with in-browser playback (whitelisted file serving)
  and approve/reject. Failed LLM providers now fail fast for the session.
  Live proof: plan → produce ran a real kokoro render scoring 89/100 pass.
  Spec archived as `studio-factory-line`.
- **2026-07-10 — Kokoro local voice shipped:** Kokoro-82M runs locally via
  `kokoro-onnx` (`npm run setup:kokoro`, `tools/kokoro/`, gitignored).
  Lesson videos default to Kokoro TTS when installed
  (`LESSON_TTS_PROVIDER` overrides; removes the ElevenLabs live-prereq),
  and the faceless workflow gains a fully local `kokoro` engine — Kokoro
  narration + Pexels b-roll + FFmpeg captions (drawtext-capable binary
  auto-resolved; Pexels key falls back to the MoneyPrinterTurbo config).
  Live proof: 40.6s 1080×1920 h264 render end-to-end. Spec archived as
  `kokoro-local-voice`.
- **2026-07-10 — Content studio + faceless workflow shipped:** TubeMagic-style
  creator toolset (`src/studio/`, `npm run studio`) — ideas, titles,
  descriptions, tags, scripts (30s–20min), brand voice, keyword research,
  transcript tooling, thumbnail concepts, ideas manager — plus a Vid.ai-style
  `npm run faceless` topic→script→brief→render workflow with batch mode and
  posting handoff. Template-mode $0 default, DeepSeek-compatible LLM upgrade.
  Same-day follow-up: `/studio` web UI on the local control server (all tools,
  ideas manager, faceless runs from the browser). Specs archived as
  `content-studio-faceless-pipeline` and `studio-web-ui`. Docs:
  `docs/content-studio.md`, `docs/faceless-workflow.md`.
- **2026-07-10 — Generation cases consolidated:** added
  `config/generation-cases.json`, `config/render-modes.json`, and
  `config/live-generation-readiness.json` as the operator-facing matrix for
  marketing render modes, Worker `render-pro`, lesson videos, and the manual
  creator MVP; `npm run check:generation-readiness` now separates local
  `strictReady` from target-host `targetHostReady`.
- **2026-07-03 — Postiz-inspired posting hardening:** reimplemented selected
  Postiz workflow patterns without copying AGPL code: provider capabilities,
  provider-specific preflight, classified posting failures, per-post failure
  isolation, explicit missed-post recovery, provider analytics fetch hooks, and
  structured SaaS Maker notes for posting errors and platform release IDs.
  SaaS Maker Cockpit now summarizes missed posts, posting failures, synced
  metrics, and metrics-pending posts from those notes.
- **2026-07-03 — Editframe-inspired HTML composition previews:** added
  `html`/`html-composition`/`web-composition` render modes that export
  deterministic `composition.html`, `timeline.json`, and word-level
  `captions.json` artifacts for agent-authored preview/review without adding a
  new video runtime dependency.
- **2026-07-02 — Grok/Imagine local MP4 integration:** added `grok-video`
  renderer mode in Node and Rust, plus optional Grok motion inserts in
  `render-pro.js` and product-proof fallback capture.
- **2026-07-03 — ASCII animation subsection renderer:** added local
  `ascii`/`ascii-animation`/`ascii-fable`/`askai` render modes for
  ASCII-fable-style interlude MP4s; high-quality renders use Chrome HTML
  terminal art with a raster fallback, and Rust shells out to the same Node
  renderer.
- **2026-07-03 — Creator MVP reset for kids stories:** documented a manual
  kids-story validation workflow in `docs/creator-mvp.md`; defer more software
  automation until the first three public-domain story videos are made and
  reviewed.
- **2026-07-03 — First creator MVP packets built out:** added complete manual
  production packets for `The Lion and the Mouse`, `The Tortoise and the Hare`,
  and `The Crow and the Pitcher` under `docs/creator-mvp-packs/`.
- **2026-07-04 — Growth format experiment layer:** added
  `docs/growth-format-playbook.md` and `src/growth-formats.js`; signal draft
  bundles now carry 5-7 posts/day, 35-post decision metadata plus per-variant
  ranking, sound-sync, tutorial, trend-copy, and before/after format notes.
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
- VideoBrief contract (`src/video-brief.js`) feeds mock, MoneyPrinterTurbo
  (default stock-footage MP4s), Grok/Imagine local MP4s, ASCII animation
  interlude MP4s, HTML/CSS composition previews, or reel-maker (+ product-proof capture) adapters;
  `render-pro.js` can insert Grok clips as generated-motion scenes when
  configured.
- Render path: `render-pro.js` / Rust `reel render` → local MP4 → artifact publisher → R2 `reel-artifacts`.
- Cloudflare Worker `reel-pipeline-artifacts` serves MP4 with byte-range support at `/reels/:key`.
- Rust autopilot/post publishes to YouTube + Instagram Graph, then PATCHes marketing queue.
- Rust crate (`reel/`) owns watch, render-accepted, autopilot, and post entrypoints; JS control layer retired for watcher/autopilot/post glue with parity validated.
- Intake `POST /reels`, review UI `GET /review`, render `POST /reels/:id/render`, video decision APIs in Node control layer.
- OpenShorts removed from pipeline; submodule still present in repo.

### Core pipeline

- VideoBrief contract; mock/MoneyPrinterTurbo/Grok local MP4/ASCII animation/HTML composition/reel-maker adapters; SaaS Maker sync.
- Intake `POST /reels`, review UI `GET /review`, render `POST /reels/:id/render`, video decision APIs.
- Artifact publisher (local + R2); Worker serves MP4 with byte-range.

### Rust orchestrator

- All entrypoints on Rust CLI; JS watcher/autopilot/post glue retired with parity validated (`validate-watcher-parity.mjs`).
- Production watcher: `npm run watch:render` → `reel watch --execute`.
- Marketing autopilot: intake → render → post in Rust (`npm run autopilot`).

### Native social posting

- YouTube + Instagram Graph publishers in `reel/src/publishers/`.
- Posting providers declare capability/preflight rules so YouTube requires a
  local video path, Instagram/Upload-Post require a public video URL, captions
  and tags are bounded before API calls, and failed posts are classified as
  reconnect/quota/rate/provider/content/asset errors.
- Post scans isolate failures per item and patch structured error notes back to
  SaaS Maker while leaving the queue item accepted for operator review.
- `reel post --missed-only --execute` runs an explicit recovery pass for
  accepted rendered posts whose scheduled time has passed and `posted_at` is empty.
- `reel metrics --execute` backfills YouTube/Instagram post metrics into SaaS
  Maker notes using the platform `external_id` saved during posting.
- Posting notes include `external_id` for the platform release ID returned by
  YouTube/Instagram/Upload-Post where available.

### OpenShorts removal

- Adapter deleted from pipeline; submodule parked (still present in repo — explicit approval needed to remove).

### Product-proof Phase 1 (2026-06-20)

- Playwright screenshot capture (`src/product-proof-capture.js`).
- Quality gate scoring (`src/reel-quality.js`): `productProofStrength`, `valueClarity`, `visualTrust`, `captionReadability`, `mobileComposition`, `cringeRisk`, `postingReadiness`.
- reel-maker composition with proof visuals; auto-wired via `resolveProductProofCapture()` in `src/pipeline.js`.
- Review UI surfaces quality dimensions; smoke at `npm run smoke:reel-maker`.

### Content studio + faceless workflow (2026-07-10)

- `src/studio/` toolset: ideas/niche/channel names, titles/descriptions/tags
  (500-char budget enforcement), scripts with duration scaling and
  article-to-script, brand-voice profiles, keyless keyword research + YouTube
  transcript fetch, thumbnail concepts with HTML previews, JSON ideas manager.
- `npm run faceless`: topic → script → VideoBrief → render via existing
  adapters (mock/MoneyPrinterTurbo), single-voice default with opt-in
  rotation, batch mode with per-topic failure isolation, manual posting
  handoff (never auto-posts).
- All tools run at $0 offline via templates; LLM upgrade via provider chain
  `free-ai` (fleet gateway) → `codex` (local CLI) → `deepseek`, order
  overridable with `STUDIO_LLM_PROVIDERS`, graceful fall-through. Smoke:
  `npm run smoke:studio`; tests: `test/studio-*.test.js`.

## Todo / Planned / Deferred / Blocked

### Planned

1. Produce the first creator-MVP kids story manually from `docs/creator-mvp-packs/lion-and-mouse.md`.
2. Produce manual validation videos 2-3 from `docs/creator-mvp-packs/tortoise-and-hare.md` and `docs/creator-mvp-packs/crow-and-pitcher.md`.
3. Record watch/parent-trust notes for the three completed videos.
4. After those three videos, decide whether Reel Pipeline should support only scene/asset manifests, draft bundles, and review handoff, or resume renderer automation.
5. Run one 35-post app-marketing experiment across the five growth formats and record format-level results.
6. Phase 2 screen-recording renderer (`demoSteps` browser flow with screenshot fallback).
7. Phase 3 multi-variant render (`variantCount` > 1) polish in review UI.
8. Wire draft bundle output into review UI without paid engines.

### Deferred

- Remove `engines/openshorts` git submodule (explicit approval).
- Cloudflare Worker rewrite of orchestration (stay on JS + Rust CLI).
- Make reel-maker/Remotion production-quality if it becomes more than the
  product-proof/reference path (`render-pro` stays canonical production renderer).
- Product-proof Phases 2–3 (screen recording, multi-variant drafts).
- Phase 2–3 product-proof PRD work not started.
- OpenShorts submodule still present though adapter removed.
- Draft bundle output not yet wired into review UI.
- Kids-story dashboards, agents, auto-uploaders, custom renderers, and
  analytics scripts until the creator MVP has three manually produced videos.

### Blocked

- Final target-host readiness is not complete until
  `tmp/generation-readiness/report.json` has `targetHostReady: true`.
  Current open case checks:
  - `marketing-render-modes`: `social-posting-prereqs` (YouTube or Instagram OAuth env)
  - `worker-render-pro`: `render-pro-live-proof` (real approved Worker reel id + R2 playback proof)
  - `lesson-video`: `lesson-live-prereqs` (DeepSeek, ElevenLabs, Pexels env)
  - `creator-mvp`: `creator-mvp-reviewed` (three manual story videos reviewed)
