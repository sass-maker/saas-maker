# Design — studio factory line

## Quality gate (`src/studio/quality.js`)

- `probeVideo(videoPath, {ffprobePath})` → `{ok, durationSeconds, width,
  height, hasAudio}` via `ffprobe -show_streams -show_format -of json`;
  returns `{ok: false, reason}` on any failure (mock placeholders).
- `scoreRender({script, probe})` → dimensions each 0–100:
  `durationFit` (|actual−target|/target), `resolution` (≥1080×1920),
  `audioPresence`, `hookStrength` (first narration ≤14 words, no weak
  openers), `pacing` (2.0–3.2 words/sec across scenes vs audio duration —
  script-only approximation when probe missing), `captionCoverage`
  (scenes with onScreenText or burned captions flag). Overall = weighted
  mean of available dimensions; verdict pass ≥70, review ≥50, fail <50.
- Pure and injectable — unit tests need no ffprobe.

## Workflow integration

`runFacelessWorkflow` gains `ideaId` (update-in-place via new
`IdeaStore.updateIdea(id, patch)`) and after render writes
`quality.json` + `summary.quality` (probe wrapped in try/catch).

## Factory (`src/studio/factory.js`, `scripts/factory.js`)

- `planIdeas({niche, count, store, llm})` → generateIdeas → save each as
  `new` with niche/angle/hook/format.
- `produceNext({count, engine, store, workflow})` → oldest `new` ideas →
  for each: `runFacelessWorkflow({topic: idea.title, niche, ideaId})` →
  `buildPublishPacket` → collect `{ideaId, ok, quality, packetDir}`;
  failures caught per idea, idea left `new`.
- `factoryStatus({store})` → counts per status, recent rendered ideas with
  artifact dirs.
- CLI: `npm run factory -- plan|produce|status` (flags mirror module args).

## Publish packet (`src/studio/packet.js`)

`buildPublishPacket({artifactDir, screenshotter})` reads script/metadata
JSON from the run dir, writes `packet/upload.md` (first title, description
from studio generator, tags joined within 500 chars, hashtags, checklist)
and a thumbnail: `renderConceptHtml` first concept → Playwright screenshot
to `thumbnail.png` when `loadPlaywrightFactory()` yields a browser,
else keep the HTML. Screenshotter injectable for tests.

## UI + API

- `GET /studio/renders-list` — ideas with status rendered/posted, joined
  with `render.json`/`quality.json`/packet presence from the artifact dir
  recorded on the idea.
- `GET /studio/render-file?path=…` — streams a file only when its resolved
  path is inside one of the artifact roots (faceless output dir,
  `artifacts/`, `tmp/studio/`); 403 otherwise; mp4/png/html content types.
- Renders panel: table of renders (title, verdict, score, engine, date) +
  `<video>` playback + approve→`posted` / reject→`new` buttons using the
  existing `/studio/status` route.

## Testing

Pure scoring tests; factory tests with stubbed workflow/store; packet tests
with temp dirs and a stub screenshotter; server tests for renders-list and
the 403 path-traversal guard. Live proof: `factory plan` + `produce` one
idea with the kokoro engine end-to-end.
