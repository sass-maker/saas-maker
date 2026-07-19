# Design — content-studio + faceless-workflow

## Approach

Two thin layers over existing plumbing. All new code is Node ESM under
`src/studio/`, tested with `node --test`, no new production dependencies.

```
topic/niche ──► studio tools (ideas, metadata, script, keywords, thumbs)
                     │ script
                     ▼
              faceless workflow ──► VideoBrief (src/video-brief.js)
                     │                     │
                     ▼                     ▼
              ideas store          render adapter (mock | moneyprinterturbo)
                     │                     │
                     ▼                     ▼
              status: rendered ──► existing post path (reel post / autopilot)
```

## Modules

| File | Responsibility |
| --- | --- |
| `src/studio/llm.js` | `StudioLlm` — generalizes the DeepSeek adapter pattern: `chatJson(messages, opts)`; `isConfigured()`; every caller passes a `fallback()` used when unconfigured or on error. Result envelope `{ source: 'llm'\|'template', ... }`. |
| `src/studio/ideas.js` | `generateIdeas({niche, count})`, `exploreNiche({niche})`, `suggestChannelNames({niche})`. Template fallback composes from format/angle/hook word banks (reuses `src/growth-formats.js` taxonomy where it fits). |
| `src/studio/metadata.js` | `generateTitles`, `generateDescription`, `generateTags`, `organizeTags`. Pure functions for bounds (500-char tag budget, ≤100-char titles) so they are unit-testable without LLM. |
| `src/studio/script.js` | `generateScript({topic, durationSeconds, voiceProfile, inspiration, article})`. Word budget = duration/60 × 150 wpm. Scene structure mirrors the lesson-pipeline shape (label, narration, brollQuery, onScreenText, durationSeconds) so briefs convert trivially. Article mode extracts headline/paragraph leads as key points first. |
| `src/studio/brand-voice.js` | `deriveVoiceProfile(transcripts)` — heuristics offline (sentence length, contractions, exclamation rate, repeated phrases) + LLM refinement when configured. |
| `src/studio/keywords.js` | `researchKeywords(seed)` — fetches Google/YouTube suggest JSON endpoints (free, keyless, `client=firefox&ds=yt`), plus a-z expansions and question prefixes; offline fallback synthesizes variants. Injectable `fetchImpl`. |
| `src/studio/transcript.js` | `fetchTranscript(youtubeUrl)` — pulls the watch page, extracts `captionTracks` baseUrl, fetches timedtext XML/JSON3, strips tags, paragraphizes; clear `{ available: false, reason }` when absent. Injectable `fetchImpl`. |
| `src/studio/thumbnails.js` | `generateThumbnailConcepts(topic)`; `renderConceptHtml(concept, dir)` writes a 1280×720 HTML artifact (same spirit as html-composition; no browser dependency in tests). |
| `src/studio/idea-store.js` | JSON file store at `tmp/studio/ideas.json` (path injectable): `saveIdea`, `listIdeas`, `updateIdeaStatus` with statuses `new → scripted → rendered → posted`. |
| `src/studio/workflow.js` | `runFacelessWorkflow({topic, ...})` and `runBatch({topics})`. Converts script → brief via a `scriptToBrief()` helper (single voice unless `voiceRotation: true`), calls the existing adapter factory from `src/pipeline.js` (mock/moneyprinterturbo), saves idea status, returns summary. Never auto-posts. |

## CLI

- `scripts/studio.js` — subcommands: `ideas`, `titles`, `description`, `tags`,
  `script`, `keywords`, `transcript`, `thumbnails`, `voice`, `list`, `save`.
  JSON in/out flags; human-readable summary to stdout.
- `scripts/faceless.js` — `--topic` | `--topics-file`, `--duration`,
  `--engine mock|moneyprinterturbo`, `--out`, `--voice`, `--post-handoff`.
- package.json: `"studio": "node scripts/studio.js"`,
  `"faceless": "node scripts/faceless.js"`,
  `"smoke:studio": "node scripts/smoke-studio.js"`.

## Key decisions

1. **Template-first, LLM-upgrade** — keeps the fleet `$0/render` constraint;
   no tool hard-requires a key. DeepSeek chosen because the adapter pattern
   already exists; base-URL/model overridable so any OpenAI-compatible
   endpoint works.
2. **No Rust changes** — the workflow is a producer for the existing queue;
   posting stays in `reel post` / autopilot. Avoids touching production paths.
3. **Scene shape reuse** — studio scripts use the lesson-pipeline scene shape
   so `scriptToBrief()` is mechanical and reuses brief validation.
4. **Single voice default** — per saved feedback; rotation is opt-in.
5. **Keyless keyword research + transcripts** — public suggest endpoints and
   public caption tracks; both injectable and mocked in tests; both degrade
   gracefully offline.

## Testing

- Unit tests per module with `fetchImpl`/LLM stubs (`test/studio-*.test.js`).
- `scripts/smoke-studio.js`: runs every tool offline (template mode) plus a
  mock-engine workflow end-to-end; wired into `npm run smoke:studio`.
- No network in tests.

## Risks

- YouTube watch-page caption extraction is scrape-adjacent and may break —
  isolated in `transcript.js` with a clear `available:false` path.
- Template output quality is intentionally basic; LLM mode is the quality
  path. Documented in docs pages.
