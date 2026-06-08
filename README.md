# Reel Pipeline

AI reel generation product that turns input text and project context into short-form video drafts and render artifacts.

This repo owns the intake, draft, render, review, artifact, and posting-handoff
flow for short-form video generation. Its current internal inputs are accepted
SaaS Maker Marketing Queue ideas and High Signal reel briefs; SaaS Maker stays
the source of truth for approvals, task links, and posting state.

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

### OpenShorts

- Upstream: `https://github.com/mutonby/openshorts`
- Local path: `engines/openshorts`
- Role: UGC actor / ReelFarm-style workflow reference.
- Why not default yet: it assumes more paid/hosted services such as Gemini,
  fal.ai, ElevenLabs, Upload-Post, and optional S3.
- Current status: guarded job-spec adapter only; it does not invoke paid UGC or
  autopost dependencies yet.

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
        +--> OpenShorts adapter for future UGC job specs
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
- `src/adapters/openshorts.js` — guarded OpenShorts UGC job-spec adapter.
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
- R2 artifact upload through Wrangler.
- R2-backed Worker serving MP4s with range requests.
- SaaS Maker Marketing Queue sync for rendered asset metadata.
- Manual posting handoff that does not mark a post as sent unless a real posting
  provider reports success.

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

Recent additions (product-proof reel generator, see `docs/prd-product-proof-reels.md`):

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
npm run smoke:full
npm run smoke:reel-maker
npm run worker:dry-run
npm run check:cloudflare
npm run bootstrap:cloudflare -- --confirm-deploy
```

Render accepted SaaS Maker queue items with the mock renderer:

```bash
npm run render:accepted -- --mode mock --limit 5
```

Render with MoneyPrinterTurbo and upload to R2:

```bash
npm run render:accepted -- --mode moneyprinterturbo --limit 1 \
  --artifact-r2-bucket reel-artifacts \
  --artifact-base-url https://reel-pipeline-artifacts.sarthakagrawal927.workers.dev/reels
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
npm run canary:moneyprinter
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
