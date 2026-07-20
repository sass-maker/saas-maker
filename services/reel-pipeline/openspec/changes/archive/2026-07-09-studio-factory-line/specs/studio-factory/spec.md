# studio-factory

## ADDED Requirements

### Requirement: Render quality gate
Every faceless workflow render SHALL be scored on video evidence (duration
fit to target, vertical resolution, audio presence) and script heuristics
(hook length, narration pacing, caption coverage), producing a 0–100 score
and a `pass`/`review`/`fail` verdict written to `quality.json` and the run
summary. Probe failures SHALL degrade to script-only scoring, never abort a
completed render.

#### Scenario: Healthy render passes
- **WHEN** a render matches its target duration within tolerance, is 1080×1920 with audio, and has a strong hook
- **THEN** the quality report verdict is `pass` with per-dimension scores

#### Scenario: Probe unavailable
- **WHEN** ffprobe cannot read the output (e.g. mock placeholder)
- **THEN** the report marks video evidence unavailable and scores script heuristics only

### Requirement: Factory conveyor
The factory SHALL support `plan` (generate and save N backlog ideas for a
niche), `produce` (advance the next N `new` ideas through script→render,
updating each idea's status on the same record), and `status` (counts per
pipeline stage plus recent renders). Produce SHALL isolate per-idea failures.

#### Scenario: Plan then produce
- **WHEN** `plan` saves 5 ideas and `produce --count 2` runs
- **THEN** exactly 2 ideas move to `rendered` with artifact links and 3 remain `new`

#### Scenario: Produce failure isolation
- **WHEN** one idea's render fails during a produce batch
- **THEN** other ideas still complete and the failed idea stays `new` with the error reported

### Requirement: Publish packet
Each produced render SHALL get a `packet/` containing an upload document
(selected title, description, tags within platform budget, hashtags, manual
upload checklist) and a thumbnail file (PNG when a browser is available,
HTML preview otherwise).

#### Scenario: Packet contents
- **WHEN** produce completes a render
- **THEN** `packet/upload.md` exists with title/description/tags/hashtags sections and a thumbnail file exists

### Requirement: Renders review in the web UI
The studio page SHALL list produced renders with quality verdicts, play the
video in the browser, and let the operator approve (`posted`-ready) or
reject an idea. Video file serving SHALL be restricted to known artifact
roots.

#### Scenario: List and play
- **WHEN** the operator opens the Renders panel after a produce run
- **THEN** the render appears with its quality verdict and a playable video element

#### Scenario: Path traversal blocked
- **WHEN** a video URL outside the artifact roots is requested
- **THEN** the server responds 403 and serves nothing
