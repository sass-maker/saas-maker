# Faceless Workflow

Vid.ai-style topic→video pipeline built on existing reel-pipeline plumbing:
one command takes a topic through script → VideoBrief → render, with batch
mode for producing a week of content in one sitting. Original implementation;
no third-party product code.

The studio tools that generate the script/metadata are documented in
[content-studio.md](./content-studio.md). Render modes and their requirements
live in `config/render-modes.json` and [generation-readiness.md](./generation-readiness.md).

## One video

```bash
npm run faceless -- --topic "five minute stretching routine" --duration 60 --engine mock
```

Steps performed:

1. Generate a scene-structured script sized to `--duration` (30–1200 seconds).
2. Convert it to a VideoBrief (`scriptToBrief`) — the brief's `durationSeconds`
   is clamped to the 5–90s reels contract; long-form length is carried by the
   script narration itself, which is what drives rendered length.
3. Generate titles + tags alongside.
4. Render through the existing adapter factory (`src/pipeline.js`).
5. Save the topic to the ideas manager with status `rendered`.

Artifacts land in `tmp/studio/faceless/<topic-slug>/` (override with `--out`):
`script.json`, `brief.json`, `metadata.json` (titles, tags, hashtags, voice
plan), `render.json`.

## Engines

- `--engine mock` (default) — placeholder render, works anywhere, used by
  smokes.
- `--engine moneyprinterturbo` — real faceless render (stock footage + TTS +
  subtitles) at $0/render. Start the API first: `npm run moneyprinter:api`.

`render-pro.js` remains the canonical production renderer; this workflow is a
draft-production path that feeds the same review/post queue.

## Voice

Single narration voice by default (`en-US-AriaNeural-Female`, override with
`--voice`). Per-scene rotation reads as disjointed for non-dialog scripts, so
it requires an explicit `--voice-rotation` opt-in. Pass a brand-voice profile
from `npm run studio -- voice` with `--voice-profile profile.json`.

## Batch production

```bash
npm run faceless -- --topics-file topics.txt --engine moneyprinterturbo
```

`topics.txt` is one topic per line (`#` comments allowed) or a JSON array.
Topics run sequentially; a failure on one topic never stops the rest. The run
writes `batch-summary.json` with per-topic success/failure and exits non-zero
if anything failed.

## Posting

The workflow never posts automatically. Rendered videos enter the normal
posting path — review, then:

```bash
npm run post:ready
```

Pass `--post-handoff` to have the run summary include that command explicitly.
Posting capability rules, preflight, and recovery are unchanged (see
[auto-posting.md](./auto-posting.md)).

## Verification

```bash
npm run smoke:studio                     # includes a mock end-to-end workflow run
node --test test/studio-workflow.test.js # brief conversion, voice, batch isolation
```
