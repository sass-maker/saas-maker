# Lesson Pipeline

Animated tutoring shorts (9:16, 30-90 sec) built locally on M1 from a lesson
spec. The pipeline stages are:

```
lesson.json
   |
   v
DeepSeek  ----> N variant scripts (hook + scenes + b-roll terms + hashtags)
   |
   +--> human review (optional, /review UI)
   |
   v
ElevenLabs ----> per-scene MP3 narration (your cloned voice)
   |
   v
Pexels     ----> per-scene vertical b-roll clip
   |
   v
FFmpeg     ----> 1080x1920 MP4 with burned-in captions + on-screen overlay
   |
   v
artifacts/lessons/<lesson-id>/<variant-id>.mp4
                              <variant-id>.txt   (transcript)
                              <variant-id>.hashtags.txt
                              .../captions.srt
```

## What lives where

| Layer | Where it runs | Status |
|---|---|---|
| Script generation | DeepSeek API | built — `src/adapters/deepseek.js` |
| Voice synthesis | ElevenLabs API | built — `src/adapters/elevenlabs.js` |
| B-roll search/download | Pexels API | built — `src/adapters/pexels.js` |
| Compose + caption burn | local M1 FFmpeg | built — `src/composer/lesson-composer.js` |
| Lesson store | local filesystem | built — `src/lesson-intake.js` |
| Review UI | local Node (`npm run dev`) | reuses existing `/review` for now |
| Artifact hosting | optional Cloudflare R2 | already wired via `src/worker/index.js` |

## M1 setup roadmap (one-time)

These are the on-machine prerequisites — none require a paid service beyond
the keys you already have.

1. **Install FFmpeg + ffprobe**
   ```bash
   brew install ffmpeg
   ffmpeg -version    # verify
   ffprobe -version   # verify
   ```

2. **API keys** — put them in `.env` next to `.env.example`:
   - `DEEPSEEK_API_KEY` — yours
   - `ELEVENLABS_API_KEY` — yours
   - `ELEVENLABS_VOICE_ID` — see step 3
   - `PEXELS_API_KEY` — free, sign up at https://www.pexels.com/api/

3. **Clone your voice in ElevenLabs (one-time, ~5 min):**
   - Record 30-60 seconds of clean speech in a quiet room. Read evenly,
     normal teaching pace.
   - In ElevenLabs Studio: VoiceLab → Instant Voice Clone → upload the sample
     → name it (e.g. `sarthak-teaching`) → save.
   - Copy the voice ID from the URL or the voice details panel.
   - Paste it into `.env` as `ELEVENLABS_VOICE_ID`.

4. **(Optional) Cloudflare R2 hosting** — only needed if you want a public
   URL per video for sharing/scheduling. Local `artifacts/` is enough to
   download + upload manually to TikTok/Instagram/YouTube.
   ```bash
   npm run bootstrap:cloudflare -- --confirm-deploy
   ```

5. **Sanity smoke** — boots the local API:
   ```bash
   npm run dev
   ```

## Authoring a lesson

A lesson is a single JSON file. Minimum required fields:

```jsonc
{
  "topic": "JavaScript closures",
  "learningObjective": "Understand how an inner function keeps access to outer scope after the outer returns",
  "keyPoints": [
    "A closure is a function plus the scope it was defined in",
    "Inner functions can still read outer variables after the outer returns",
    "Each outer call creates an independent scope"
  ],
  "example": {
    "setup": "function makeCounter() returns an inner increment function",
    "problem": "What if you call makeCounter() twice?",
    "solution": "Each counter has its own count because each call captures a fresh scope"
  },
  "recap": "Closure = function + captured scope.",
  "cta": "Follow for daily JS lessons.",
  "channel": "tiktok",
  "durationSeconds": 50,
  "variantCount": 2
}
```

Optional fields:
- `audience` — string, used to tune script tone.
- `hookStyle` — `curiosity_gap | pattern_interrupt | pov | stakes`.
- `voicePreference` — `{ "voiceId": "...", "modelId": "..." }` to override
  the `.env` defaults per lesson.

A working fixture is at `test/fixtures/lessons/closures.json`.

## End-to-end run

The fastest path, no review gate:

```bash
npm run lesson:render -- --input test/fixtures/lessons/closures.json --auto-approve
```

This will:
1. Create a draft, store it under `.reel-pipeline/lessons/<id>.json`.
2. Call DeepSeek `variantCount` times to produce script variants.
3. Synthesize per-scene narration via ElevenLabs.
4. Pull per-scene b-roll via Pexels.
5. Compose each variant into a 1080×1920 MP4 with burned captions.
6. Write artifacts under `artifacts/lessons/<id>/` and update the lesson
   record with variant metadata.

Output per variant:
- `<variant-id>.mp4` — the final video.
- `<variant-id>.txt` — full narration transcript.
- `<variant-id>.hashtags.txt` — recommended hashtags, space-joined.

## Two-stage flow with manual review

Better quality during the campaign's first week — review scripts before
spending audio + render time.

```bash
# Step 1: draft + scripts only
npm run lesson:render -- --input test/fixtures/lessons/closures.json --skip-render

# Step 2: review and approve (CLI shortcut; UI wiring below)
npm run lesson:render -- --lesson <lessonId> --approve

# Step 3: render
npm run lesson:render -- --lesson <lessonId> --render
```

List all lessons:
```bash
npm run lesson:render -- --list
```

## Cost per lesson (rough)

For a 50-second lesson with 2 variants, ~140 words of narration per variant:

| Provider | Usage | Cost |
|---|---|---|
| DeepSeek (deepseek-chat) | ~8k tokens total | ~$0.002 |
| ElevenLabs (eleven_turbo_v2_5) | ~1500 characters | ~$0.05 on Starter |
| Pexels | 10 video downloads | $0 |
| M1 compute | ~2-4 min FFmpeg | $0 |
| **Total** | | **~$0.05** |

ElevenLabs Free tier (10k chars/mo) covers ~7 two-variant lessons. Starter
($5/mo, 30k chars) covers ~20 two-variant lessons. Creator ($22/mo, 100k
chars) covers ~70.

## Troubleshooting

**"DEEPSEEK_API_KEY is required"** — `.env` not loaded. Either run with the
env var inline or use a dotenv loader; the existing scripts assume
environment is already exported.

**"ffmpeg not found on PATH"** — `brew install ffmpeg`, or set
`FFMPEG_PATH=/full/path` in `.env`.

**"no b-roll for scene N"** — Pexels returned no portrait videos matching
that query. Inspect the script's `brollQuery` for the scene; either retry
with a different `hookStyle` (generates a new script) or hand-edit the
stored lesson JSON under `.reel-pipeline/lessons/<id>.json` to use better
search terms, then re-render.

**Captions feel slightly off** — v1 uses scene-level timing (each sentence
gets an even share of its scene's audio duration). For word-aligned
captions, drop in whisper.cpp later — see roadmap.

**Voice sounds robotic** — bump `stability` (0.5-0.7) and `similarity`
(0.85-0.95) in your lesson's `voicePreference`. Re-record the source clone
sample in a more anechoic space if needed.

## Roadmap

Things deliberately not built yet — call them in when needed:

- **Word-aligned captions** via local whisper.cpp. Replace
  `buildSrtFromScenes` with a whisper pass over the concatenated narration.
  ~1 day.
- **Lesson library + batch script** — feed a markdown/JSON list of N lessons,
  render all overnight. ~half day on top of the current CLI.
- **Worker review UI for lessons** — extend `src/worker/index.js` with
  `/lessons*` routes mirroring the existing `/reels*` ones. ~1 day.
- **Posting bundle** — a `bundle.zip` containing mp4 + transcript + hashtags
  + suggested upload time per platform. ~2 hours.
- **Music bed** — mix in a low-volume royalty-free track for energy. Add a
  `-i music.mp3` and an `amix` filter to the composer. ~2 hours.
- **Quality scorer** — adapt `src/reel-quality.js` to teaching content: hook
  strength, jargon density, example concreteness. ~half day.
- **Auto-posting** — TikTok/Instagram/YouTube don't have stable creator APIs
  for sustained automation. Schedule via Buffer / Later free tier OR keep
  manual until volume justifies a dedicated provider.
