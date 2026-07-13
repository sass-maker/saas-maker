# Reel Pipeline

The public product does one thing: paste a public HTTPS brand website and get a
presenter-led vertical reel. It fetches the site safely, extracts cited brand
facts and visuals, creates the script/storyboard, and renders a downloadable
9:16 video with a fictional synthetic human presenter. There is no login,
account, billing, workspace, actor onboarding, or social connection in this
flow.

Run `npm run dev`, open the root page, and submit the brand URL. The older review,
studio, and fleet marketing utilities documented below are internal tooling;
they are not visitor product surfaces and do not add identity to the anonymous
brand-reel path.

## Creator MVP First

For kids story videos, do not start by building more pipeline software. Start
with the manual creator stack in [`docs/creator-mvp.md`](docs/creator-mvp.md):
public-domain story, rewritten script, consistent illustrated scenes, warm
narration, simple edit, music/SFX, thumbnail, and YouTube Studio upload.

The first validation target is three manually produced videos:

1. [`The Lion and the Mouse`](docs/creator-mvp-packs/lion-and-mouse.md)
2. [`The Tortoise and the Hare`](docs/creator-mvp-packs/tortoise-and-hare.md)
3. [`The Crow and the Pitcher`](docs/creator-mvp-packs/crow-and-pitcher.md)

Until those exist and pass a parent-trust quality review, avoid adding new
dashboards, agents, custom renderers, auto-uploaders, or analytics scripts for
the kids-story bet.

## Growth Format Testing

For app marketing reels, the objective is to find a repeatable format that gets
views consistently. Use the [growth format playbook](docs/growth-format-playbook.md)
for the 5-7 posts/day, 35-post experiment loop across ranking, sound-sync,
tutorial, trend-copy, and before/after formats.

Signal draft bundles now include per-variant growth format metadata and the
35-post decision rule; rendering and autopost still stay behind review gates.

## Content Studio + Faceless Workflow

For creator tooling (video ideas, titles, tags, scripts, keyword research,
thumbnails) see [`docs/content-studio.md`](docs/content-studio.md); for the
one-command topic→script→render faceless pipeline with batch mode see
[`docs/faceless-workflow.md`](docs/faceless-workflow.md). Fast paths:

```bash
npm run studio -- ideas --niche "home espresso"
npm run faceless -- --topic "latte art basics" --engine mock
```

## Tutoring Lesson Pipeline

If you want animated tutoring shorts (DeepSeek script → ElevenLabs voice →
Pexels b-roll → FFmpeg compose, runs entirely on M1), start at
[`docs/lesson-video-pipeline.md`](docs/lesson-video-pipeline.md). The fast path is:

```bash
npm run lesson:render -- --input test/fixtures/lessons/closures.json --auto-approve
```

## Why This Repo Exists

The fleet now has a marketing queue, but marketing docs alone are not enough.
The useful loop is:

1. Agents create product-specific AI-video ideas in SaaS Maker Marketing Queue.
2. Sarthak accepts or rejects each idea in the UI.
3. Accepted reel ideas are rendered into MP4 drafts.
4. The public artifact URL is written back to the Marketing Queue item.
5. Posting remains gated until there is an explicit schedule/provider.

The first goal is reliable draft generation, not fully autonomous social spam.

## Language Note

GitHub shows this repo as JavaScript because the code in this repo is a small
Node.js / Cloudflare Workers orchestration layer.

That is intentional for now:

- No frontend framework or build step is needed for the control API.
- Cloudflare Workers, R2 upload, SaaS Maker API calls, and CLI scripts are all
  straightforward in Node.
- The heavy video engines are not implemented here; they are pinned submodules
  under `engines/` and run behind adapters.
- MoneyPrinterTurbo itself is Python/FFmpeg/MoviePy; OpenShorts brings Python,
  Docker, Gemini/fal/ElevenLabs style dependencies; reel-maker is the older
  Remotion/Modal prototype.

So JavaScript here means orchestration glue, not that the actual video rendering
stack is JavaScript-only.

## What It Uses

### SaaS Maker

- Repo: `https://github.com/sarthak-fleet/saas-maker`
- Role: control plane and system of record.
- Owns: Marketing Queue, project fleet metadata, task linkage, approval status,
  changelog-derived marketing ideas, and Cockpit UI.
- Integration: this repo reads accepted queue items and patches back
  `asset_url`, `result_url`, provider metadata, and posting handoff notes.

### MoneyPrinterTurbo

- Upstream: `https://github.com/harry0703/MoneyPrinterTurbo`
- Local path: `engines/MoneyPrinterTurbo`
- Role: default cheap renderer for stock-footage reels.
- Why first: MIT licensed, heavily used, actively maintained, and practical for
  fast MP4 generation with stock footage, voice, subtitles, and FFmpeg.
- Dependencies: Python 3.11, FFmpeg, ImageMagick, one LLM provider, stock media
  source such as Pexels/Pixabay or local materials, optional Redis.
- Current status: adapter implemented, local canary implemented, real MP4 upload
  to R2 verified.

### Grok / Imagine Videos

- Source: local MP4 exports generated outside this repo, for example Grok
  Imagine science clips.
- Role: curated premium/source footage when a finished Grok clip already exists;
  clips can be inserted into normal generated reels or published as a standalone
  `grok-video` render.
- Why local: there is no credentialed Grok API path in this repo; the adapter
  only copies approved local MP4s and returns standard render metadata.
- Configure: set `GROK_VIDEO_ASSET_DIR` to a folder containing `.mp4` exports.
- Current status: `grok-video` render mode implemented in Node and Rust;
  `render-pro.js` can also insert one matching Grok clip as a motion scene when
  `GROK_VIDEO_ASSET_DIR` is set.

### ASCII Animation Inserts

- Source: local generated ASCII/pixel animation inspired by
  `adithyaakrishna/ascii-fable`.
- Role: stylized subsection/interlude footage for explaining abstract ideas
  between higher-fidelity Grok/Imagine or product-proof scenes.
- Why local: this is deterministic generated motion; no API credentials or
  external model calls are required.
- Configure: use render mode `ascii`, `ascii-animation`, `ascii-fable`, or
  `askai`. The high-quality path renders HTML terminal art through headless
  Chrome, then assembles MP4s with `ffmpeg`; set `REEL_ASCII_RENDERER=raster`
  for the faster no-Chrome fallback, or `FFMPEG_PATH` if needed.
- Current status: Node adapter implemented; Rust orchestrator shells out to the
  same Node renderer for parity.

### Editframe-Inspired HTML Composition

- Upstream: `https://editframe.com/`
- Role: agent-friendly preview format for videos as deterministic HTML/CSS
  scenes with a timeline and word-level caption cues.
- Why not depend on it: keep Reel Pipeline local-first and avoid adding another
  production video runtime before the preview contract proves useful.
- Configure: use render mode `html`, `html-composition`, or `web-composition`.
  The output is `composition.html`, `timeline.json`, and `captions.json`, not a
  posting-ready MP4.
- Current status: Node adapter implemented; Rust orchestrator shells out to the
  same Node exporter for parity.

### OpenShorts

- Upstream: `https://github.com/mutonby/openshorts`
- Local path: `engines/openshorts`
- Role: UGC actor / ReelFarm-style workflow reference.
- Why not default yet: it assumes more paid/hosted services such as Gemini,
  fal.ai, ElevenLabs, Upload-Post, and optional S3.
- Current status: adapter removed from the active pipeline; submodule is parked
  as a reference.

### reel-maker

- Upstream: `https://github.com/sarthakagrawal927/reel-maker`
- Local path: `engines/reel-maker`
- Role: older internal Remotion + Modal prototype.
- Current status: kept as a reference engine. It should either be superseded by
  this repo or reused behind the same `VideoBrief` adapter contract.

### Cloudflare

- Worker: `reel-pipeline-artifacts`
- R2 bucket: `reel-artifacts`
- Live artifact base URL:
  `https://reel-pipeline-artifacts.sarthakagrawal927.workers.dev`
- Worker routes:
  - `GET /health`
  - `GET /reels/:key`
- The artifact Worker supports byte-range responses so MP4 playback works in
  browsers.

## Credits & Inspiration

Design ideas borrowed from other open-source projects (we adapted concepts, not
code):

### OpenMontage

- Upstream: `https://github.com/calesthio/OpenMontage` (AGPLv3)
- Role: agent-first video production system; we deliberately did **not** adopt
  its runtime (it conflicts with our deterministic Rust autopilot), but stole
  two of its quality gates:
  - **Slideshow-risk scoring** — `src/reel-quality.js` flags reels that read as
    a deck of static cards so they are not auto-posted.
  - **Post-render self-review** — `src/reel-self-review.js` probes the actually
    rendered file with `ffprobe` (real duration, aspect, audio) instead of
    trusting the renderer's claimed metadata.

### Postiz

- Upstream: `https://github.com/gitroomhq/postiz-app` (AGPLv3)
- Role: social publishing workflow reference; we deliberately did **not** copy
  source or adopt its NestJS/Prisma/Temporal runtime.
- Reimplemented concepts:
  - **Provider capabilities and preflight** — posting providers now declare
    whether they need local files, public URLs, caption/title/tag limits, and
    channel support before calling platform APIs.
  - **Actionable posting failures** — posting errors are classified as
    reconnect, quota, rate limit, provider outage, bad caption, bad asset, or
    unknown, then patched back to SaaS Maker notes without marking the post sent.
  - **Per-post isolation** — one bad post no longer aborts the whole ready-post scan.
  - **Missed-post recovery** — `reel post --missed-only --execute` limits a
    recovery run to overdue scheduled posts that still have no `posted_at`.
  - **Metrics backfill** — `reel metrics --execute` fetches YouTube statistics
    and Instagram media insights, then patches a compact metrics block into
    SaaS Maker notes.
  - **Release IDs** — posting notes include the platform `external_id` so later
    metrics backfill does not need to infer IDs from URLs.

## Architecture

```text
SaaS Maker Marketing Queue
        |
        | accepted reel-channel item
        v
VideoBrief contract
        |
        +--> MockRenderer for tests/local smoke
        +--> MoneyPrinterTurbo adapter for real stock-footage MP4s
        +--> GrokVideo adapter for curated local Grok/Imagine MP4s
        +--> AsciiAnimation adapter for stylized generated interlude MP4s
        +--> HtmlComposition adapter for preview HTML + timeline/captions JSON
        +--> ReelMaker adapter for Remotion/product-proof MP4s
        |
        v
Artifact publisher
        |
        +--> local public directory for local testing
        +--> Cloudflare R2 for production artifacts
        |
        v
SaaS Maker Marketing Queue patched with video metadata
```

Core files:

- `src/video-brief.js` — normalizes and validates queue items into a video brief.
- `src/signal-intake.js` — maps High Signal reel briefs and SaaS Maker product-improvement ideas into `VideoBrief` drafts.
- `src/signal-draft-generator.js` — prototype multi-variant draft bundles with claim/evidence review.
- `src/reel-intake.js` — creates API-submitted reel drafts and records approval decisions.
- `src/review-ui.js` — plain HTML/CSS/JS swipe review UI.
- `src/pipeline.js` — creates render jobs and syncs completed artifacts back.
- `src/adapters/moneyprinterturbo.js` — MoneyPrinterTurbo API adapter.
- `src/adapters/grok-video.js` — local Grok/Imagine MP4 asset adapter.
- `src/adapters/ascii-animation.js` — generated ASCII/pixel animation adapter.
- `src/adapters/html-composition.js` — HTML/CSS composition preview exporter.
- `src/adapters/reel-maker.js` — Remotion/product-proof adapter.
- `src/artifact-publisher.js` — local and R2 artifact publishing.
- `src/posting.js` — gated posting handoff / provider abstraction.
- `src/worker/index.js` — Cloudflare Worker for serving R2 MP4 artifacts.

## Current Status

Working now:

- `POST /reels` intake endpoint for project/product details.
- `GET /review` swipe UI for approving or rejecting generated reel ideas.
- `GET /reels` and `PATCH /reels/:id/decision` review APIs.
- `POST /reels/:id/render` for approved drafts.
- `PATCH /reels/:id/video-decision` to accept rendered videos as ready to post or reject them.
- `renderMode: "remotion"` through the pinned `engines/reel-maker` Remotion engine.
- VideoBrief validation for TikTok, Instagram Reels, and YouTube Shorts ideas.
- Mock renderer for fast no-dependency end-to-end tests.
- MoneyPrinterTurbo adapter and local canary.
- Grok/Imagine local MP4 adapter (`renderMode: "grok-video"`) and optional
  generated-motion inserts in `render-pro.js`.
- R2 artifact upload through Wrangler.
- R2-backed Worker serving MP4s with range requests.
- SaaS Maker Marketing Queue sync for rendered asset metadata.
- Manual posting handoff that does not mark a post as sent unless a real posting
  provider reports success.
- Provider-specific posting preflight and classified posting failure notes for
  YouTube, Instagram, Upload-Post, and manual handoff.
- Explicit missed-post recovery, provider-level metrics backfill, and SaaS
  Maker Cockpit posting-ops summaries for missed/error/metrics states.

Not done yet:

- Real UGC actor pipeline.
- Real autopost provider wiring.
- Custom domain for artifacts.
- Scheduled background job runner.

End-to-end automation (run on a Mac that has Chrome, ffmpeg, `uvx`, wrangler):

```bash
# 1. Pull approved SaaS Maker marketing ideas → create reel drafts on worker
SAASMAKER_SESSION_TOKEN=... npm run sync:saasmaker

# 2. Watch for human-approved reels and auto-render them (long-running)
npm run watch:render
```

The watcher polls `/reels?status=approved` every 30s. Any reel where
`renderJobId === null` and `variants === []` gets rendered by
`scripts/render-pro.js` (Chrome scroll-tour, Edge TTS, music bed, ScreenStudio
frame, etc.). Renders run serially. Per-variant accept/reject still happens in
the `/review` UI.

Recent additions (product-proof reel generator, see `docs/archive/2026-06-20-prd-product-proof-reels-phase1-shipped.md`):

- Playwright/Chrome product screenshot + demo recording capture
  (`src/product-proof-capture.js`).
- Five product-proof reel templates (`src/reel-templates.js`):
  problem → product proof → CTA, before/after, changelog proof, mini-demo,
  teardown/audit.
- `POST /reels/:id/render` accepts `variantCount` (1-6); each variant uses a
  different template/hook layout.
- Local quality scoring (`src/reel-quality.js`) with seven dimensions, gating
  variants into `video_ready`, `needs_review`, or `video_rejected`.
- `/review` UI iterates per-variant with per-variant accept/reject and shows the
  quality score plus reasons.

## Commands

```bash
npm test
npm run smoke:mock
npm run smoke:generation-cases
npm run smoke:render-modes
npm run check:generation-readiness
npm run ready:local
npm run ready:proofs
npm run ready:target
npm run smoke:full
npm run smoke:reel-maker
npm run moneyprinter:api
npm run worker:dry-run
npm run check:cloudflare
npm run bootstrap:cloudflare -- --confirm-deploy
```

Check local generation-mode readiness:

```bash
npm run ready:local
```

The generation-cases smoke covers marketing render modes, the Worker
`render-pro` entrypoint, lesson-video CLI readiness, and manual creator packet
presence. The render-modes smoke reads
[`config/render-modes.json`](config/render-modes.json) and verifies the unified
`render:accepted` path for `mock`, `html-composition`, `ascii`, `grok-video`,
and `reel-maker` without external credentials. It reports MoneyPrinterTurbo and
`render-pro` separately because those require live services and production
render environment; the true `render-pro` live proof is a manual target-host
check because it mutates a real Worker reel record and R2 object. The readiness checker reads
[`config/live-generation-readiness.json`](config/live-generation-readiness.json)
and writes `tmp/generation-readiness/report.json`; use
`npm run ready:proofs` after starting `npm run moneyprinter:api` in another
terminal to refresh required local/live proofs. Use `npm run ready:target` for
final target-host acceptance; it refreshes refreshable proof reports and fails
unless `targetHostReady` is true. Pass `--acceptance
<acceptance.json>` to `check:generation-readiness` only for documented
target-host exceptions.
The report prints both `strictReady` and `targetHostReady`; only
`targetHostReady: true` means the selected host is fully accepted. When it is
false, use the report's `targetHostNextActions` array, or the CLI `next ...`
lines, for the exact remaining commands and target-host docs.

For the full local/live readiness checklist, use
[`docs/generation-readiness.md`](docs/generation-readiness.md).
For unresolved target-host checks, use
[`docs/target-host-readiness.md`](docs/target-host-readiness.md).

Render accepted SaaS Maker queue items with the mock renderer:

```bash
npm run render:accepted -- --mode mock --limit 5
```

Render with MoneyPrinterTurbo and upload to R2:

```bash
npm run moneyprinter:api
MONEYPRINTER_API_URL=http://127.0.0.1:18080 npm run canary:moneyprinter
npm run render:accepted -- --mode moneyprinterturbo --limit 1 \
  --artifact-r2-bucket reel-artifacts \
  --artifact-base-url https://reel-pipeline-artifacts.sarthakagrawal927.workers.dev/reels
```

Render accepted SaaS Maker queue items with local Grok/Imagine MP4s:

```bash
GROK_VIDEO_ASSET_DIR=/path/to/grok-mp4s \
npm run render:accepted -- --mode grok-video --limit 1 \
  --artifact-r2-bucket reel-artifacts \
  --artifact-base-url https://reel-pipeline-artifacts.sarthakagrawal927.workers.dev/reels
```

Use Grok/Imagine clips as inserted motion inside normal `render-pro` reels:

```bash
GROK_VIDEO_ASSET_DIR=/path/to/grok-mp4s npm run render:pro -- demo-linkchat-1
```

Render accepted queue items with the reel-maker/Remotion adapter:

```bash
npm run render:accepted -- --mode reel-maker --limit 1
```

Render an ASCII-fable-style subsection clip locally:

```bash
node scripts/render-ascii-animation.js --brief ./path/to/brief.json --artifact-dir ./artifacts/ascii-animation
```

Run without SaaS Maker auth using fixtures:

```bash
npm run render:accepted -- \
  --fixture test/fixtures/accepted-marketing-posts.json \
  --mode mock \
  --limit 1
```

Prepare posting handoff for ready accepted posts:

```bash
npm run post:ready -- \
  --fixture test/fixtures/post-ready-marketing-posts.json \
  --posting-provider manual \
  --confirm-post \
  --limit 1
```

## Local API

Start the local API:

```bash
npm run dev
```

Smoke health:

```bash
curl -sS http://127.0.0.1:4317/health
```

Create a reel draft from product details:

```bash
curl -sS http://127.0.0.1:4317/reels \
  -H 'content-type: application/json' \
  -d '{
    "projectId": "linkchat",
    "projectSlug": "linkchat",
    "channel": "tiktok",
    "goal": "Show creators that their profile can answer repeated questions",
    "audience": "solo creators with link-in-bio traffic",
    "realDetails": {
      "product": "link-in-bio AI chat profile",
      "proof": "answers repeated profile questions before the creator opens DMs",
      "risk": "early product, keep the claim narrow"
    },
    "cta": "Ask the profile one question."
  }'
```

Create a reel draft from a High Signal reel brief or SaaS Maker improvement signal:

```bash
curl -sS http://127.0.0.1:4317/reels/signal \
  -H 'content-type: application/json' \
  -d @test/fixtures/high-signal-reel-brief.json
```

### Signal-to-reel draft prototype (no paid render)

Convert a High Signal brief fixture into a reviewable draft bundle with storyboard,
script, shot list, and captions for **two or more variants**. Claims that need
evidence are flagged; unsupported claims are rejected and kept out of scripts.

Fixture fields: `targetAudience`, `offer`, `productConstraints`, `evidenceUrls`,
`claimBoundary`, optional `unsupportedClaims`.

```bash
npm run draft:signal -- --fixture test/fixtures/high-signal-reel-brief.json
npm run draft:signal -- --fixture test/fixtures/high-signal-reel-brief.json --variants 2
```

Output: `tmp/signal-drafts/<signalId>-draft-bundle.json`

Verify:

```bash
npm test -- test/signal-draft-generator.test.js
```

Review generated drafts:

```bash
open http://127.0.0.1:4317/review
```

Or review by API:

```bash
curl -sS 'http://127.0.0.1:4317/reels?status=generated'

curl -sS http://127.0.0.1:4317/reels/<reelId>/decision \
  -X PATCH \
  -H 'content-type: application/json' \
  -d '{"decision":"approve"}'

curl -sS http://127.0.0.1:4317/reels/<reelId>/render \
  -X POST \
  -H 'content-type: application/json' \
  -d '{"mode":"remotion","variantCount":3}'

curl -sS http://127.0.0.1:4317/reels/<reelId>/video-decision \
  -X PATCH \
  -H 'content-type: application/json' \
  -d '{"decision":"approve","variantId":"<reelId>-v1"}'
```

Create a mock render:

```bash
curl -sS http://127.0.0.1:4317/renders \
  -H 'content-type: application/json' \
  -d '{
    "id": "brief-1",
    "projectSlug": "linkchat",
    "channel": "tiktok",
    "title": "AI profile answers repeated DMs",
    "hook": "POV: your link-in-bio answers the same DM before you see it.",
    "body": "Script: show repeated DMs then Linkchat answering them.\nShot list: phone DM pile, product chat screen, result screen.\nCaptions: same question again, let the profile answer first.\nAsset prompts: vertical phone UI, creator desk, product demo.",
    "cta": "Open the profile and ask one question.",
    "renderMode": "mock"
  }'
```

Render accepted queue items through the local API:

```bash
curl -sS http://127.0.0.1:4317/marketing/render-accepted \
  -H 'content-type: application/json' \
  -d '{"mode":"mock","limit":5}'
```

## Environment

Do not commit `.env` files or provider tokens.

Expected local variables when connecting to real SaaS Maker / providers:

- `SAASMAKER_API_URL` or default `https://api.sassmaker.com`
- `SAASMAKER_SESSION_TOKEN` for session-auth Marketing Queue access
- `MONEYPRINTER_API_URL` or default `http://127.0.0.1:8080`
- Provider-specific keys stored in the relevant engine config, not in this repo

Use `.env.example` as the non-secret template.

The local Node API stores review drafts under `.reel-pipeline/reels` by default.
The deployed Cloudflare Worker stores review drafts as JSON objects in the
configured R2 bucket under `reel-requests/`.

## Submodules

Clone with submodules:

```bash
git clone --recurse-submodules https://github.com/sarthak-fleet/reel-pipeline.git
```

Or initialize after cloning:

```bash
git submodule update --init --recursive
```

Pinned engines:

```bash
git submodule status
```

See:

- `docs/submodules.md`
- `docs/engine-pins.md`
- `docs/upstreams.md`
- `docs/architecture.md`

## Update Policy

Do not casually update upstream engines on `main`.

Upgrade flow:

```bash
git checkout -b upgrade/video-engines-YYYY-MM-DD
git submodule update --remote engines/MoneyPrinterTurbo
npm test
npm run smoke:mock
MONEYPRINTER_API_URL=http://127.0.0.1:18080 npm run canary:moneyprinter
```

Accept an engine update only after at least one real render canary passes and the
artifact URL/path is recorded in the task or PR.

## Release Verification

Baseline checks before release:

```bash
npm test
npm run worker:dry-run
npm run check:cloudflare
REEL_ARTIFACT_BASE_URL=https://reel-pipeline-artifacts.sarthakagrawal927.workers.dev \
  REEL_ARTIFACT_SMOKE_KEY=fixture-real-render.mp4 \
  npm run smoke:artifact
```

SaaS Maker fleet integration lives in:

- `../saas-maker/foundry.projects.json`
- `../saas-maker/scripts/lib/fleet-health-contracts.mjs`
- `../saas-maker/scripts/fleet-production-smoke.mjs`

## Practical Caveat

The pipeline is technically working. The generated videos are still low-quality
until we improve creative direction, footage selection, UGC actor support, and
post-render review. Treat the current release as infrastructure and draft
production, not final marketing quality.

For kids story reels, the immediate product risk is not missing automation. It
is making generic AI content that parents do not trust. Keep that workflow
manual until the first three story videos prove the format.
