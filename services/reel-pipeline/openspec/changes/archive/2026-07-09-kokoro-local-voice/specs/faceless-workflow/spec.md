# faceless-workflow delta

## MODIFIED Requirements

### Requirement: Topic to rendered video in one command
The workflow SHALL take a topic (plus optional niche, duration, voice, and
brand-voice profile) and produce: a script, a VideoBrief, and a rendered MP4
via an existing render adapter, writing artifacts under an output directory.
Supported engines SHALL be `mock` (smoke runs), `moneyprinterturbo` (stock
footage + Edge-TTS via the local MoneyPrinterTurbo API), and `kokoro` (fully
local compose: Kokoro narration + Pexels b-roll + FFmpeg). `render-pro.js`
remains the canonical production renderer and is not modified.

#### Scenario: Mock end-to-end
- **WHEN** the workflow runs with `--engine mock` for a topic
- **THEN** it writes script.json, brief.json, and a rendered artifact, and exits 0

#### Scenario: Duration honored
- **WHEN** the user passes a target duration
- **THEN** the generated brief's scene durations sum to the target ± 10%

#### Scenario: Kokoro engine selected
- **WHEN** the workflow runs with `--engine kokoro`
- **THEN** the render uses the local Kokoro compose adapter and no MoneyPrinterTurbo API call is made
