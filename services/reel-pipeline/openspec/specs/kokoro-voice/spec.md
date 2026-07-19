# kokoro-voice Specification

## Purpose
TBD - created by archiving change kokoro-local-voice. Update Purpose after archive.
## Requirements
### Requirement: Local Kokoro TTS adapter
The system SHALL synthesize narration audio locally through Kokoro-82M
(`kokoro-onnx`) with no network calls at synthesis time, exposing the same
scene-audio interface as the ElevenLabs adapter and reporting readiness
(model installed) without throwing.

#### Scenario: Batch scene synthesis
- **WHEN** `synthesizeSceneAudio` runs with N scenes and Kokoro is installed
- **THEN** it returns N entries with wav paths for non-empty narrations, loading the model once

#### Scenario: Not installed
- **WHEN** Kokoro setup has not been run
- **THEN** `isKokoroReady()` returns false and callers can fall back without an exception

### Requirement: Lesson TTS provider selection
The lesson pipeline SHALL select its TTS provider via `LESSON_TTS_PROVIDER`
(`kokoro` or `elevenlabs`), defaulting to Kokoro when installed and
ElevenLabs otherwise.

#### Scenario: Kokoro installed, no env override
- **WHEN** a lesson renders and Kokoro is ready and `LESSON_TTS_PROVIDER` is unset
- **THEN** narration is synthesized by the Kokoro adapter

#### Scenario: Explicit elevenlabs
- **WHEN** `LESSON_TTS_PROVIDER=elevenlabs`
- **THEN** the ElevenLabs adapter is used regardless of Kokoro readiness

### Requirement: Kokoro faceless render engine
The faceless workflow SHALL support a `kokoro` engine that produces an MP4
from a studio script using Kokoro narration, Pexels b-roll per scene, and the
existing FFmpeg lesson compositor. The Pexels key SHALL resolve from
`PEXELS_API_KEY`, falling back to the local MoneyPrinterTurbo config file,
and SHALL never be logged.

#### Scenario: Local kokoro render
- **WHEN** the workflow runs with `--engine kokoro` and Kokoro + a Pexels key are available
- **THEN** it writes a rendered MP4 whose narration audio was produced by Kokoro

#### Scenario: Missing prerequisites
- **WHEN** the `kokoro` engine runs without Kokoro installed or without a resolvable Pexels key
- **THEN** it fails with an actionable error naming the setup command or missing key

