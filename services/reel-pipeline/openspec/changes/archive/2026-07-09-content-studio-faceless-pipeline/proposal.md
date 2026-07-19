# Content Studio + Faceless Workflow

## Why

The goal is feature parity, inside reel-pipeline, with two commercial products:
TubeMagic (AI YouTube content studio: ideas, titles, descriptions, tags,
scripts, keyword research, thumbnail concepts, transcript tooling) and Vid.ai
(faceless short/long-form video generation: topic → script → voiceover →
visuals → captions → assemble → auto-post, batched weekly production).

Reel-pipeline already owns the Vid.ai back half — VideoBrief contract,
MoneyPrinterTurbo faceless renderer (stock footage + TTS + captions), R2
artifact hosting, and Rust YouTube/Instagram posting + autopilot. What is
missing is the front half: an ideation/metadata/script studio and a single
topic-to-posted-video workflow. This is an original implementation of the
functionality only — no code, copy, or branding from either product.

## What Changes

- New `src/studio/` module family: LLM text tools with a deterministic
  template fallback so every tool runs at $0 with no API key.
  - Video idea generation + niche exploration + channel name generation
  - Titles, descriptions, tags (+ tag organizer), hashtags
  - Long/short script generation (target length 30s–20min), brand-voice
    profile derived from sample transcripts, article-to-script,
    transcript formatting (YouTube URL → clean transcript when captions
    are publicly available)
  - Keyword research via free suggest endpoints (no API key)
  - Thumbnail concept generator (text concepts; optional HTML render via
    the existing html-composition path)
  - Ideas manager: JSON file store for saved ideas/drafts
- New faceless workflow command: topic → script → VideoBrief → render via
  existing adapters (mock for smoke, MoneyPrinterTurbo for real) → optional
  handoff to the existing post queue. Batch mode over a topics file.
- New CLI entrypoints (`npm run studio`, `npm run faceless`) and tests.
- Docs: `docs/content-studio.md` and `docs/faceless-workflow.md`.

Non-goals (OUT): no new video runtime, no paid APIs required for the default
path, no cinematic/avatar generation, no changes to render-pro.js as the
canonical production renderer, no per-scene voice rotation by default.

## Capabilities

### New Capabilities

- `content-studio`: text-generation toolset for YouTube/shorts creators —
  ideas, metadata (titles/descriptions/tags), scripts, brand voice, keyword
  research, thumbnail concepts, ideas store; works offline via templates,
  upgrades via DeepSeek-compatible LLM env.
- `faceless-workflow`: one-command topic→rendered-video pipeline reusing
  VideoBrief + existing render adapters and posting queue, with batch mode.

### Modified Capabilities

(none — existing render/post specs unchanged; workflow composes them)

## Impact

- New code under `src/studio/`, `scripts/studio.js`, `scripts/faceless.js`,
  tests under `test/studio-*.test.js`, docs pages, package.json scripts.
- Reuses: `src/adapters/deepseek.js` pattern (generalized LLM client),
  `src/video-brief.js`, `src/pipeline.js` render adapters,
  `src/file-reel-store.js` persistence pattern.
- No changes to Rust crate, Worker, or production render path.
- Optional env: `DEEPSEEK_API_KEY` (or compatible base URL/model) for
  LLM-quality output; everything degrades to deterministic templates.
