# PRD: Product-Proof Reel Generator

## Summary

Build a free/low-cost reel generation path that turns SaaS Maker marketing ideas
into reviewable short videos using real product proof instead of generic AI
visuals. The first useful version should submit an idea, capture product UI,
compose a vertical video with captions and voiceover, upload the MP4, and let the
user accept or reject the rendered video before posting.

The current pipeline already proves the plumbing: idea intake, idea approval,
render invocation, R2 upload, video playback, and final video approval. The next
problem is creative quality. This PRD is for improving the output, not replacing
the control plane.

## Goals

- Produce videos that are clearly about the actual product within 3 seconds.
- Avoid paid image/video generation APIs for the default path.
- Use real screenshots, screen recordings, changelog/task proof, or app UI as
  the main visual source.
- Keep SaaS Maker / Reel Pipeline as the source of truth for idea state,
  rendered asset state, and posting readiness.
- Generate multiple draft videos per accepted idea so the user can pick the best
  one.
- Preserve the explicit gates:
  - idea created
  - idea accepted or rejected
  - video rendered
  - rendered video accepted or rejected
  - accepted video ready for posting

## Non-Goals

- Do not build autonomous social posting in this phase.
- Do not depend on paid UGC actors, fal, ElevenLabs, Gemini video, OpenAI video,
  or other paid generation APIs for the default path.
- Do not make Cloudflare Workers perform local browser/video rendering.
- Do not optimize for viral entertainment before product proof is reliable.
- Do not create generic motivational AI slop with stock visuals.

## Primary User

Sarthak, operating the Active AI product fleet. He wants agents to create video
ideas automatically, but he only wants to manually review videos that already
have concrete product proof and are safe to post.

## Problem

The pipeline can generate and serve MP4s, but the first generated videos look
bad because they use abstract generated cards instead of real product evidence.
The value proposition is not obvious enough, the visuals are not trustworthy,
and the output does not yet justify posting.

## Product Principle

If the video does not show a real product moment, it is not ready.

Every generated reel must include at least one concrete proof artifact:

- product screenshot
- short screen recording
- task/changelog evidence
- before/after UI state
- generated output from the actual product
- cockpit/queue proof when the product is internal

## User Flow

1. An agent submits a reel idea through `POST /reels`.
2. The user reviews idea cards in `/review`.
3. The user approves promising ideas.
4. The renderer creates `N` variants for each approved idea.
5. Each variant uses one of the approved product-proof templates.
6. The MP4s are uploaded to R2.
7. The user reviews rendered videos in `/review`.
8. The user rejects bad videos or marks good videos `ready_to_post`.
9. Posting remains manual or separately gated.

## Inputs

### Required

- `projectSlug`
- `channel`: `tiktok`, `instagram_reels`, or `youtube_shorts`
- `goal`
- `hook`
- `body` with script, shot list, captions, and asset prompts
- `cta`

### Preferred

- `productUrl`
- `proofUrl`
- `targetRoute`
- `demoSteps`
- `changelogEntryId`
- `taskId`
- `screenshots`
- `recordingUrl`
- `brandTone`

## Output Contract

Each rendered video record should include:

- `id`
- `sourceReelId`
- `variantId`
- `status`: `video_ready`, `ready_to_post`, `video_rejected`, `posted`
- `assetUrl`
- `thumbnailUrl` when available
- `durationSeconds`
- `template`
- `proofType`
- `captionText`
- `qualityScore`
- `qualityReasons`
- `renderLog`

## Templates

### 1. Problem -> Product Proof -> CTA

Best default for SaaS products.

- First 2 seconds: direct pain.
- Middle: real UI screenshot or recording.
- End: one action.

Example:

- Problem: "Stop answering the same DM manually."
- Proof: Linkchat profile answering the question.
- CTA: "Ask the profile one question."

### 2. Before -> After

Use when the product changes a workflow state.

- Before: messy state, repeated work, confusing list.
- After: product output or organized result.

### 3. Changelog Proof

Use when the source is a shipped feature.

- Show changelog/task title.
- Show product screen or generated artifact.
- CTA: "Try the new flow."

### 4. Mini Demo

Use when the product has a simple browser flow.

- Open route.
- Click/enter one thing.
- Show the result.
- Caption each step.

### 5. Teardown / Audit

Use for High Signal, CodeVetter, and analysis products.

- Claim.
- Evidence screen.
- Recommendation/result.

## Free Visual Sources

Prioritize in this order:

1. Playwright/Chrome screenshot of the product route.
2. Playwright/Chrome screen recording of a short flow.
3. Existing images or screenshots in the repo.
4. SaaS Maker changelog/task screenshot.
5. Generated UI cards as fallback only.

## Free Audio Sources

Default:

- macOS `say` for local smoke.
- Edge TTS if already available in the engine.

Rules:

- Keep script short.
- Avoid fake hype.
- Captions should carry the message even if audio is muted.

## Quality Gate

Before a video can become `video_ready`, it should pass a local quality check.

Required checks:

- First frame contains a clear product/pain statement.
- At least one real proof artifact is present.
- CTA is visible or spoken.
- Duration is 8-25 seconds for default reels.
- No placeholder/rainbow/generic abstract-only visuals.
- Captions are readable on mobile.
- Video is 9:16 and playable with byte-range support after upload.

Quality score dimensions:

- 3-second value clarity
- product proof strength
- visual trust
- caption readability
- mobile composition
- cringe/spam risk
- posting readiness

## System Design

### Control Plane

Keep existing Reel Pipeline APIs:

- `POST /reels`
- `GET /reels`
- `PATCH /reels/:id/decision`
- `POST /reels/:id/render`
- `PATCH /reels/:id/video-decision`

Add variant support:

- `POST /reels/:id/render` accepts `variantCount`.
- Render response returns all generated variants.
- `/review` can review rendered variants one by one.

### Rendering

Rendering may run locally or on future Modal workers. The default local path
should:

1. Resolve project metadata from fleet config.
2. Open the product URL/route with browser automation when possible.
3. Capture screenshots or short recordings.
4. Compose the final MP4 locally with FFmpeg/Remotion/HTML capture.
5. Upload to R2.
6. Attach metadata back to the reel record.

### Storage

Use R2 for:

- final MP4
- thumbnail
- optional render manifest

Use the existing Worker for:

- artifact serving
- byte-range playback
- CORS

## Implementation Phases

### Phase 1: Product Screenshot Renderer

Deliver a renderer that turns one approved idea into one product-proof MP4.

Acceptance criteria:

- Given `projectSlug`, `productUrl`, `hook`, `body`, and `cta`, the renderer
  captures at least one screenshot.
- The MP4 uses the screenshot as the main visual.
- Captions are readable.
- The video uploads to R2.
- `/review` shows the rendered video.
- The user can mark it `ready_to_post` or `video_rejected`.

### Phase 2: Screen Recording Renderer

Deliver browser-flow proof.

Acceptance criteria:

- Renderer accepts `demoSteps`.
- It records a short browser flow.
- It crops/composes the recording into 9:16.
- It falls back to screenshots when recording fails.

### Phase 3: Variants

Deliver multiple outputs per idea.

Acceptance criteria:

- `POST /reels/:id/render` accepts `variantCount`.
- At least 3 hook/layout variants can be generated locally.
- UI shows variants separately.
- User can accept one and reject the rest.

### Phase 4: Quality Scoring

Deliver a local quality gate.

Acceptance criteria:

- Each render gets a `qualityScore`.
- Bad renders are marked `needs_review` or rejected before posting readiness.
- Quality reasons are visible in the review UI.

## Agent Task Split

### Agent A: Product Proof Capture

Owns:

- project URL resolution
- Playwright/Chrome screenshot capture
- optional demo-step capture
- local fixture tests

Files likely touched:

- `src/adapters/reel-maker.js`
- new `src/product-proof-capture.js`
- tests under `test/`

### Agent B: Render Variants + Review UI

Owns:

- variant records
- rendered-video review UX
- final accept/reject flow
- thumbnail display

Files likely touched:

- `src/reel-intake.js`
- `src/review-ui.js`
- `src/server/index.js`
- `src/worker/index.js`
- tests under `test/`

### Agent C: Quality Gate

Owns:

- scoring rules
- render manifest
- rejection reasons
- smoke command

Files likely touched:

- new `src/reel-quality.js`
- `scripts/smoke-reel-maker.js`
- `README.md`
- tests under `test/`

## Validation

Minimum checks before merging:

```bash
npm test
npm run worker:dry-run
REEL_ARTIFACT_R2_BUCKET=reel-artifacts \
REEL_ARTIFACT_BASE_URL=https://reel-pipeline-artifacts.sarthakagrawal927.workers.dev/reels \
npm run smoke:reel-maker
```

Manual validation:

- Open `/review`.
- Create or locate an approved idea.
- Render it.
- Play the uploaded video.
- Mark it `ready_to_post`.

## Success Criteria

This is successful when:

- The user can submit an idea and get at least 3 reviewable videos without paid
  generation APIs.
- At least one video clearly shows real product proof.
- The user can reject bad variants and accept the best one.
- Accepted videos are visibly ready for manual posting.
- The default output is no longer generic/rainbow/placeholder.

## Open Questions

- Which projects have reliable public URLs for capture?
- Should internal products use local screenshots or production screenshots?
- Should video scripts be generated in SaaS Maker before reaching Reel Pipeline?
- Should accepted videos sync back to SaaS Maker Marketing Queue immediately or
  only after final `ready_to_post`?
