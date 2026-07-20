# Studio factory line

## Why

The studio has good individual tools (ideas, scripts, renders, posting
machinery) but no production line connecting them. To be a real content
factory it needs: automated quality control on every render, a
backlog→produce conveyor over the ideas manager, publish-ready packets for
upload, and in-browser review of rendered videos.

## What Changes

- **Render quality gate** (`src/studio/quality.js`): every faceless render is
  scored — video probe (duration fit, resolution, audio present via ffprobe)
  plus script heuristics (hook strength, pacing words/sec, caption coverage)
  — into a 0–100 score with pass/review/fail verdict, written to
  `quality.json` and the run summary.
- **Factory conveyor** (`src/studio/factory.js` + `npm run factory`):
  `plan` fills the ideas backlog for a niche; `produce` takes the next N
  `new` ideas through the full workflow (marking them `scripted`/`rendered`
  on the same idea record instead of duplicating entries); `status` shows
  the pipeline counts and recent renders.
- **Publish packets** (`src/studio/packet.js`): each produced render gets a
  `packet/` with upload.md (chosen title, description, tags line, hashtags,
  checklist) and a thumbnail — PNG via Playwright when available, HTML
  otherwise.
- **Renders review in the web UI**: a Renders panel listing produced videos
  with quality verdicts, in-browser playback (whitelisted file serving),
  and approve/reject that updates idea status.

## Capabilities

### New Capabilities

- `studio-factory`: quality gate, plan/produce/status conveyor, publish
  packets, and renders review UI.

### Modified Capabilities

- `faceless-workflow`: run summary gains a quality report; workflow can
  update an existing idea instead of always creating one.

## Impact

- New: `src/studio/{quality,factory,packet}.js`, `scripts/factory.js`,
  tests. Modified: `src/studio/{workflow,api,ui,idea-store}.js`,
  `package.json`, docs, PROJECT_STATUS.
