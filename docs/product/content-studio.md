# Content Studio

TubeMagic-style creator toolset built into reel-pipeline: ideation, metadata,
scripts, brand voice, keyword research, transcripts, thumbnail concepts, and a
saved-ideas manager. Original implementation; no third-party product code.

Every tool works offline at $0 via deterministic templates, and upgrades to
LLM output through a provider chain tried in order (override with
`STUDIO_LLM_PROVIDERS`):

1. **free-ai** — the fleet's free gateway; set `FREE_AI_API_KEY` (optional
   `FREE_AI_BASE_URL`, `FREE_AI_MODEL` defaults to `auto`,
   `FREE_AI_PROJECT_ID` defaults to `reel-pipeline`).
2. **codex** — the local Codex CLI on PATH, run non-interactively in a
   read-only sandbox (your ChatGPT subscription; optional
   `STUDIO_CODEX_MODEL`). Slower per call than HTTP providers.
3. **deepseek** — `DEEPSEEK_API_KEY` (optional `DEEPSEEK_BASE_URL` /
   `DEEPSEEK_MODEL` for any OpenAI-compatible endpoint).

Results carry `source: "llm"` (plus the `provider` that answered) or
`source: "template"`. A provider failure falls through to the next, then to
templates — never an error.

For the topic→video→post workflow that consumes these tools, see
[faceless-workflow.md](./faceless-workflow.md).

## Web UI

Every tool below is also usable from the browser: run `npm run dev` and open
`http://127.0.0.1:4317/studio`. The page has one panel per tool, an ideas
manager with status dropdowns, and a faceless-run panel (mock engine by
default; select `moneyprinterturbo` when `npm run moneyprinter:api` is up).

## Commands

All tools run through one CLI and print JSON:

```bash
npm run studio -- <command> [flags]
```

| Command | What it does |
| --- | --- |
| `ideas --niche "home espresso" --count 10` | Video ideas: title, angle, hook, format |
| `niche --niche "home espresso"` | Sub-niche suggestions with audience + competition |
| `channel --niche "home espresso"` | Channel name suggestions |
| `titles --topic "latte art" --count 5` | Title variants (≤100 chars) |
| `description --topic "latte art" --hook "..." --cta "..."` | Description with hook, chapters block, CTA, hashtags |
| `tags --topic "latte art" --niche "coffee"` | Tags deduped and fit to YouTube's 500-char budget |
| `organize --tags "tag1,tag2,..."` | Clean/rank an existing tag list into the budget |
| `script --topic "latte art" --duration 60` | Scene-structured script (see below) |
| `voice --samples a.txt,b.txt` | Brand-voice profile from sample transcripts |
| `keywords --seed "latte art"` | Keyword research via free suggest endpoints |
| `transcript --url <youtube-url>` | Fetch + format public captions |
| `thumbnails --topic "latte art" --render tmp/thumbs` | Thumbnail concepts, optional HTML previews |
| `save / list / status` | Ideas manager (see below) |

## Scripts

`script` targets 30 seconds to 20 minutes, scaling narration to ~150 words per
minute. Output is scene-structured (`label`, `narration`, `brollQuery`,
`onScreenText`, `durationSeconds`) — the same shape the lesson pipeline uses,
so it converts directly to a VideoBrief. Scripts default to a single narration
voice; per-scene rotation is opt-in (see the workflow doc).

Extra inputs:

- `--article file.txt` — article-to-script: extracts key points and adapts
  them; also works as "YouTube transcript → new script" when you feed it a
  transcript from the `transcript` command.
- `--inspiration file.txt` — pacing/structure reference (wording never copied).
- `--voice-profile profile.json` — output of `voice`, shapes tone and phrasing.

## Brand voice

`voice` measures sentence length, exclamation/question rates, contraction
usage, repeated phrases, and top vocabulary, then (LLM mode) refines that into
tone descriptors and style notes. Save the JSON and pass it to `script` or
`faceless` runs for consistent channel voice.

## Keyword research

Uses public autocomplete suggest endpoints (no API key): the seed plus
question-style prefixes (`how to`, `what is`, `why`, `best`, `vs`), ranked to
favor long-tail, intent-heavy phrases. Offline or blocked? It returns template
variants instead of failing.

## Transcripts

`transcript` pulls the watch page, finds public caption tracks (English
preferred), and returns a cleaned, paragraph-formatted transcript. Videos
without public captions return `{ "available": false, "reason": ... }` —
this path scrapes public data and may break if YouTube changes its markup;
it is isolated in `src/studio/transcript.js`.

## Thumbnails

`thumbnails` produces concepts (composition, ≤4-word overlay, emotion, color
pair). `--render <dir>` also writes 1280×720 HTML previews you can screenshot
— same spirit as the html-composition render mode, no browser dependency.

## Ideas manager

Saved ideas live in a JSON store (`tmp/studio/ideas.json` by default,
`STUDIO_IDEAS_FILE` to override) with statuses `new → scripted → rendered →
posted`:

```bash
npm run studio -- save --title "Latte art in 60s" --niche coffee
npm run studio -- list --status new
npm run studio -- status --id idea_... --to scripted
```

The faceless workflow saves each rendered topic here automatically.

## Verification

```bash
npm run smoke:studio   # offline smoke: every tool + mock workflow (13 checks)
node --test test/studio-*.test.js
```

Module map: `src/studio/{llm,ideas,metadata,script,brand-voice,keywords,transcript,thumbnails,idea-store,workflow}.js`.
