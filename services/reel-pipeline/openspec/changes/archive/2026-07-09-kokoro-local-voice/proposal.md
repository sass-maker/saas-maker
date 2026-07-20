# Kokoro local voice

## Why

The operator wants Kokoro as the mainline narration voice. Today the only
Kokoro path is the reel-maker Modal deployment (remote), lesson videos need
paid ElevenLabs, and faceless renders use Edge-TTS inside MoneyPrinterTurbo.
Kokoro-82M runs locally on M1 via `kokoro-onnx` at $0 — matching the fleet
free-render constraint and removing the ElevenLabs live-prereq for lessons.

## What Changes

- One-time setup script (`npm run setup:kokoro`) creates a local venv under
  `tools/kokoro/` (gitignored) and downloads the Kokoro ONNX model + voices.
- `src/adapters/kokoro.js`: local TTS adapter with the same
  `synthesizeSceneAudio(scenes, options)` shape as the ElevenLabs adapter;
  batch synthesis through one python invocation; `isKokoroReady()` probe.
- Lesson pipeline gains TTS provider selection (`LESSON_TTS_PROVIDER`,
  default: kokoro when installed, else elevenlabs — back-compat).
- New `kokoro` render engine for the faceless workflow: studio script →
  Kokoro narration → Pexels b-roll → existing `composeLesson` FFmpeg
  assembly → MP4. Pexels key resolves from env, falling back to the local
  MoneyPrinterTurbo config so no new credentials are needed.
- Render-mode registration: `kokoro`/`kokoro-compose` in the VideoBrief
  contract, `createRenderer`, the faceless CLI/API allowlists, and
  `config/render-modes.json`.

## Capabilities

### New Capabilities

- `kokoro-voice`: local Kokoro TTS adapter + setup, lesson TTS provider
  selection, and the local-compose faceless render engine.

### Modified Capabilities

- `faceless-workflow`: engine set gains `kokoro` (local compose) alongside
  mock and moneyprinterturbo.

## Impact

- New: `scripts/setup-kokoro.sh`, `scripts/kokoro_tts.py`,
  `src/adapters/kokoro.js`, `src/adapters/kokoro-compose.js`, tests.
- Modified: `src/lesson-pipeline.js`, `src/pipeline.js`,
  `src/video-brief.js`, `src/studio/workflow.js`, `src/studio/api.js`,
  `scripts/faceless.js`, `config/render-modes.json`, `.gitignore`, docs.
- ~340MB one-time local model download; no runtime network after setup
  except Pexels b-roll fetch.
