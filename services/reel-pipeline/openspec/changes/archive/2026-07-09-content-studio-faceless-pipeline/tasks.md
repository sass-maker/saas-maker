# Tasks — content-studio + faceless-workflow

## 1. Foundation

- [x] 1.1 `src/studio/llm.js` — StudioLlm client with template fallback envelope; unit test with stub fetch
- [x] 1.2 `src/studio/idea-store.js` — JSON idea store; unit test in temp dir

## 2. Studio tools (TubeMagic parity)

- [x] 2.1 `src/studio/metadata.js` — titles/description/tags/organizeTags; unit tests for bounds
- [x] 2.2 `src/studio/ideas.js` — ideas/niche explorer/channel names; unit tests
- [x] 2.3 `src/studio/script.js` — script gen incl. duration scaling, article-to-script; unit tests
- [x] 2.4 `src/studio/brand-voice.js` — voice profile heuristics; unit test
- [x] 2.5 `src/studio/keywords.js` — suggest-endpoint research with offline fallback; unit test with stub fetch
- [x] 2.6 `src/studio/transcript.js` — YouTube caption fetch + formatting; unit test with stub fetch
- [x] 2.7 `src/studio/thumbnails.js` — concepts + HTML preview writer; unit test

## 3. Faceless workflow (Vid.ai parity)

- [x] 3.1 `src/studio/workflow.js` — scriptToBrief (single-voice default), runFacelessWorkflow, runBatch; unit tests incl. batch failure isolation
- [x] 3.2 Mock-engine end-to-end path verified via workflow test

## 4. CLI + smoke

- [x] 4.1 `scripts/studio.js` CLI with subcommands
- [x] 4.2 `scripts/faceless.js` CLI (topic/topics-file/engine/duration/post-handoff)
- [x] 4.3 `scripts/smoke-studio.js` + package.json scripts (`studio`, `faceless`, `smoke:studio`)
- [x] 4.4 Full `npm test` green

## 5. Docs + status

- [x] 5.1 `docs/content-studio.md` (tool reference, env, examples)
- [x] 5.2 `docs/faceless-workflow.md` (topic→post walkthrough, batch, posting handoff)
- [x] 5.3 Update `PROJECT_STATUS.md` (features, timeline, commands) + README pointer
