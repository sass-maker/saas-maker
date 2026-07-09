# faceless-workflow Specification

## Purpose
TBD - created by archiving change content-studio-faceless-pipeline. Update Purpose after archive.
## Requirements
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

### Requirement: Single-voice default
Generated briefs SHALL use one narration voice for the entire video by
default; per-scene voice rotation SHALL require an explicit opt-in flag.

#### Scenario: Default voicing
- **WHEN** the workflow generates a brief without a rotation flag
- **THEN** every scene uses the same voice id

### Requirement: Batch production
The workflow SHALL accept a topics file (one topic per line or JSON array) and
process each topic sequentially, isolating failures per topic and writing a
batch summary (succeeded/failed per topic).

#### Scenario: Batch with one failure
- **WHEN** a batch of 3 topics runs and one topic's render fails
- **THEN** the other 2 complete and the summary records 2 succeeded / 1 failed

### Requirement: Posting handoff
The workflow SHALL optionally hand a rendered video to the existing posting
path by saving the idea/draft with rendered status and printing the exact
existing post command; it SHALL NOT post automatically without the explicit
flag used by the existing Rust posting layer. When given an existing idea id
the workflow SHALL update that idea's status in place instead of creating a
duplicate entry, and the run summary SHALL include the render quality report.

#### Scenario: Handoff without auto-post
- **WHEN** a workflow render completes without a post flag
- **THEN** no posting API is called and the summary includes the manual post command

#### Scenario: Existing idea advanced
- **WHEN** the workflow runs with an `ideaId` from the backlog
- **THEN** that idea moves to `rendered` and no new idea entry is created

