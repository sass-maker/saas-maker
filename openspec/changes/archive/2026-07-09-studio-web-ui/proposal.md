# Studio Web UI

## Why

The content-studio and faceless-workflow capabilities shipped as CLI + modules
(archived change `content-studio-faceless-pipeline`). The operator wants a
website to use the tools without dropping to the terminal — the same ask
review UI already answers for reel approval.

## What Changes

- New `GET /studio` page on the existing local control server (`npm run dev`)
  — a dense single-page operator UI with one panel per studio tool (ideas,
  niche, channel names, titles, description, tags, script, brand voice,
  keywords, transcript, thumbnails, ideas manager, faceless run).
- New `POST /studio/:tool` JSON API routes on the same server that call the
  existing `src/studio/` modules, plus `GET /studio/ideas-list`.
- Faceless runs from the UI use the mock engine by default and accept
  `moneyprinterturbo` when the local API is running; posting stays out.
- No new dependencies, no Worker changes, no new deploy surface (local
  operator tool, same as `/review`).

## Capabilities

### New Capabilities

- `studio-web-ui`: HTTP API + HTML page exposing every content-studio tool
  and the faceless workflow from the local control server.

### Modified Capabilities

(none — `content-studio` and `faceless-workflow` requirements unchanged; the
UI is a new consumer)

## Impact

- `src/server/index.js` (route registration), new `src/studio/ui.js` (page
  html) and `src/studio/api.js` (tool dispatch), tests
  `test/studio-server.test.js`, docs pointer in `docs/content-studio.md`.
