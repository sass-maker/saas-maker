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

Also available from the browser: `npm run dev`, then the "Faceless run" panel
at `http://127.0.0.1:4317/studio`.

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
- `--engine kokoro` — fully local render: Kokoro-82M narration (local ONNX,
  no network at synth time) + Pexels b-roll + FFmpeg compose with burned
  captions. One-time setup: `npm run setup:kokoro` (~340MB model download).
  The Pexels key resolves from `PEXELS_API_KEY` or the local
  MoneyPrinterTurbo config; captions auto-select a drawtext-capable ffmpeg.
  Voice: `af_heart` default, override with `KOKORO_VOICE` (Kokoro-style
  names like `am_adam`).
- `--engine moneyprinterturbo` — stock footage + Edge-TTS + subtitles through
  the local MoneyPrinterTurbo API. Start it first: `npm run moneyprinter:api`.

`render-pro.js` remains the canonical production renderer; this workflow is a
draft-production path that feeds the same review/post queue.

## Voice

Single narration voice by default — `af_heart` (Kokoro engine) or
`en-US-AriaNeural-Female` (MoneyPrinterTurbo), override with `--voice`.
Per-scene rotation reads as disjointed for non-dialog scripts, so it requires
an explicit `--voice-rotation` opt-in. Pass a brand-voice profile from
`npm run studio -- voice` with `--voice-profile profile.json`.

Lesson videos share the same voice stack: `LESSON_TTS_PROVIDER` selects
`kokoro` (default when installed) or `elevenlabs`.

## Batch production

```bash
npm run faceless -- --topics-file topics.txt --engine moneyprinterturbo
```

`topics.txt` is one topic per line (`#` comments allowed) or a JSON array.
Topics run sequentially; a failure on one topic never stops the rest. The run
writes `batch-summary.json` with per-topic success/failure and exits non-zero
if anything failed.

## Factory conveyor

The production line over the ideas manager:

```bash
npm run factory -- plan --niche "everyday personal finance" --count 10
npm run factory -- produce --count 2 --engine kokoro --duration 45
npm run factory -- status
```

`plan` fills the backlog (`new` ideas with angle/hook/format). `produce`
advances the next N `new` ideas through script → render → quality gate →
publish packet, updating each idea in place (failures leave the idea `new`
for retry). Both are also panels in the `/studio` web UI, and the **Renders**
panel lists produced videos with their quality verdicts, plays them in the
browser, and approves (→`posted`) or rejects (→`new`) each one.

Every render gets:

- `quality.json` — 0–100 score and pass/review/fail verdict across duration
  fit, resolution, audio presence, hook strength, pacing, and caption
  coverage (video evidence via ffprobe; degrades to script-only heuristics
  when the file can't be probed).
- `packet/upload.md` — chosen title + alternates, description, tags line
  within the 500-char budget, hashtags, and a manual upload checklist, plus
  a thumbnail (PNG when Playwright is installed, HTML preview otherwise).

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
