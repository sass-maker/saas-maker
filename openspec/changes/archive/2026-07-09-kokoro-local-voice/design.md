# Design — kokoro local voice

## Runtime layout

```
tools/kokoro/            (gitignored)
├── .venv/               python venv with kokoro-onnx + soundfile
├── kokoro-v1.0.onnx     ~310MB model (github release download)
└── voices-v1.0.bin      voice embeddings
```

`scripts/setup-kokoro.sh` (npm alias `setup:kokoro`) is idempotent: venv →
pip install → curl model/voices if missing → smoke synth one word.

## Modules

- `scripts/kokoro_tts.py` — stdin JSON `{scenes: [{text, outPath}], voice,
  speed, lang}` → loads the model once, writes wavs, prints per-scene JSON
  result lines. Torch-free (onnxruntime CPU).
- `src/adapters/kokoro.js` —
  - `isKokoroReady()`: venv python + model files exist.
  - `KokoroTts.synthesizeScenes(scenes, {voice, speed, outputDir})`: spawns
    the venv python once per batch; returns `[{sceneIndex, path, byteLength}]`
    (ElevenLabs-compatible shape).
  - `synthesizeSceneAudio(scenes, options)` — drop-in for the lesson
    pipeline's injectable synthesizer.
  - Injectable `runner` for tests (no python in CI).
- `src/adapters/kokoro-compose.js` — `KokoroComposeAdapter.createVideo(brief)`
  needs the studio script (scene narrations + broll queries): passed via
  constructor option `script`; throws an actionable error without it.
  Pipeline: kokoro wavs → `fetchScenebRoll` (Pexels) → `composeLesson`
  (existing FFmpeg compositor) → standard `{provider, status, videos}` result.
  `resolvePexelsKey()`: env `PEXELS_API_KEY` → parse
  `engines/MoneyPrinterTurbo/config.toml` `pexels_api_keys` (never logged).
- Lesson pipeline: `resolveTtsProvider()` → explicit `LESSON_TTS_PROVIDER`
  wins; otherwise kokoro when ready, else elevenlabs. Injection point
  (`options.synthesizeSceneAudio`) unchanged.
- Registration: `kokoro`/`kokoro-compose` added to `normalizeRenderMode`,
  `createRenderer` (requires `options.kokoroCompose.script`), studio
  workflow/API/CLI engine allowlists, `config/render-modes.json` entry.

## Testing

All unit tests stub the python runner / synth / broll / composer:
adapter batch shape, readiness=false path, lesson provider selection,
compose adapter orchestration order, engine allowlist. Live proof (manual,
this machine): setup, one real wav, one full `--engine kokoro` render.

## Risks

- ~340MB model download at setup; script is resumable/idempotent.
- kokoro-onnx pulls onnxruntime; pinned versions in the setup script keep
  installs reproducible.
- Reading the MPT config for the Pexels key couples us to that file's format;
  isolated in one function with env override.
