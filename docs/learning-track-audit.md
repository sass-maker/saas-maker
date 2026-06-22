# Fleet Projects — Learning Track Audit

**Date:** 2026-06-13
**Scope:** All sub-projects inside `/Users/sarthak/Desktop/fleet/`
**Rule:** Add a learning track (decisions, lessons, retros, study notes) for projects using "fancy" / non-standard tech (ML, AI, novel runtimes, systems programming, exotic frameworks, research-y stacks). Skip for plain full-stack web dev.
**Reference standard:** `tinygpt`

## Audit table

| # | Project | Tech stack | Verdict | Learning track | Action |
|---|---------|------------|---------|----------------|--------|
| 1 | ai-game | TS, R3F, Rapier, Phaser, CF Workers/DO, autonomous LLM agent loop | Fancy | Partial | Add DECISIONS.md + consolidate scattered docs/ into docs/learning/ |
| 2 | anime_list | Next.js 16, Hono, Turso, shadcn, Jikan API sync | Standard | Missing | Skip |
| 3 | CodeVetter | Tauri 2 (Rust), React 19, SQLite, multi-LLM | Fancy | Missing | Add DECISIONS.md (Tauri choice, multi-LLM abstraction) + LEARNINGS.md (agent replay, synthetic QA) |
| 4 | drank | Next.js 16, localStorage, Recharts | Standard | Partial (PROJECT_STATUS.md) | Skip |
| 5 | email-manager | Next.js 16, CF Workers/D1, in-browser HF Transformers (ONNX), IndexedDB, Drizzle | Fancy | Partial (plans/) | Add DECISIONS.md (in-browser ONNX vs server, IndexedDB privacy model, Workers deploy constraints) |
| 6 | event-forecast | Rust, Rocket, SQLx, TimescaleDB, Tokio, custom probabilistic forecaster | Fancy | Missing | Add docs/learning/ — decision log (Rust+Rocket, stats-before-ML), Timescale schema choices, lessons as model evolves |
| 7 | everythingrated | Next.js 16, Drizzle, CF D1/Workers | Standard | Missing | Skip |
| 8 | free-ai | Hono, CF Workers/DO/D1/KV/Workers AI, multi-LLM router | Fancy | Missing | Add docs/learning/ — DECISIONS.md (DO for health state, scoring formula, neuron budget) + RETROS.md |
| 9 | high-signal | Next.js+Hono, CF Workers/D1, Python (GLiNER, GLiREL, FinBERT, pgvector, VectorBT, NetworkX) | Fancy | Missing | Add docs/learning/ — DECISIONS.md (D1 vs Postgres, GLiNER vs spaCy, two-tier judge) + LESSONS.md + retros/ for phase pivots |
| 10 | knowledgebase | Python, FastAPI, pgvector, Qdrant, fastembed, instructor, DuckDB, Torch, Streamlit, hybrid RAG | Fancy | Present (LEARNING.md, NOTES.md, SESSION_LOG.md, GROK_FINDINGS.md, PROJECT_STATUS.md, WRITEUP.md, LIVE_VERIFICATION.md) | Already covered |
| 11 | linkchat | Next.js 16, Drizzle, Turso, CF Workers/D1/R2, Vercel AI SDK | Standard | Missing | Skip |
| 12 | local-ai | Node, Express 5, SSE, CLI process spawning of Claude Code/Codex/Gemini | Fancy | Partial (PROJECT_STATUS.md) | Add DECISIONS.md (CLI spawn vs direct API, SSE framing per provider, submodule vs Foundry helper) |
| 13 | looptv | Next.js 16, Python, HF Transformers (BERT NER), yt-dlp, CF Pages | Fancy | Missing | Add DECISIONS.md (static catalog vs DB, NER model, IFrame over API) + docs/learning/ (Turbopack, HF pipeline lessons) |
| 14 | open-historia | Next.js 16, MapLibre GL (WebGL LOD), Turso, CF Workers, multi-LLM as game engine | Fancy | Partial (PROJECT_STATUS, AUDIT) | Add DECISIONS.md (AI-as-engine JSON contract, storySoFar compression, MapLibre LOD) + docs/learning/ (prompt engineering, multi-provider) |
| 15 | pace | Swift/SwiftUI, Apple FM, LM Studio (local VLM/LLM), WhisperKit, Kokoro TTS, ScreenCaptureKit, AX, MCP, BM25 RAG | Fancy | Partial (architecture, PRDs, smoke logs) | Add docs/decisions/ ADRs (model swap rationale, Apple FM default, loopback-guard, WhisperKit deferral) |
| 16 | personal-memory | Markdown + YAML + Obsidian, agent-executable prompt commands, belief-confidence tracking | Fancy | Missing | Add DECISIONS.md (Markdown-as-truth, Obsidian vs DB, tier model) + LEARNINGS.md from running the memory loop |
| 17 | port-whisperer | Rust, clap, comfy-table, lsof/ps syscalls, framework detection heuristics | Fancy | Missing | Add docs/learning/ — DECISIONS.md (Rust over Node, batched-lsof arch, orphan tradeoff) + LESSONS.md (lsof/ps parsing gotchas) |
| 18 | psi-swarm | Node, Lighthouse 12, headless Chrome, Ink, Astro, multi-LLM (Claude/Codex/Gemini), monorepo | Fancy | Partial (PRDs, PROJECT_STATUS) | Add docs/learning/ — DECISIONS.md (Lighthouse over PSI API, multi-backend) + LESSONS.md (sampling, p99 stabilization) + retro on Node 22/24 issue |
| 19 | reader | Next.js 16 on CF Workers (OpenNext), Turso, R2, multi-LLM via AI SDK, MV3 extension, pdfjs, readability | Fancy | Missing | Add DECISIONS.md (OpenNext vs Vercel, Turso edge, AI gateway/BYOK, MV3 side-panel vs popup) |
| 20 | reel-pipeline | Node, CF Workers, Python/FFmpeg/MoviePy engines, Gemini/fal/ElevenLabs, R2, MoneyPrinterTurbo/OpenShorts/Remotion | Fancy | Partial (architecture, engine-pins, PRDs) | Add docs/learning/ — phase retros on engine selection trade-offs, LLM/TTS provider evals, Workers orchestration lessons |
| 21 | researchPapers | ClickHouse, FastAPI, Astro+React, sentence-transformers, MLX (Qwen2.5-3B-4bit), spaCy/scispaCy, KeyBERT, NetworkX PageRank | Fancy | Missing | Add docs/learning/ — ClickHouse vs Postgres for workload, MLX vs sentence-transformers, PageRank impl, embedding dim/model rationale |
| 22 | rolepatch | Next.js 16, Turso, CF Workers, AI SDK, Puppeteer, Dodo Payments | Standard | Missing | Skip |
| 23 | saas-maker | TS monorepo (The Foundry), Hono, CF Workers/D1/R2/DO/Containers, Next.js, Astro, Droid autonomous runner w/ DeepSeek | Fancy | Partial (research/) | Add docs/decisions/ (DO+Containers for Droid, better-auth vs Auth.js, AGENTS.md-injection vs DB) + docs/retros/ per Droid milestone |
| 24 | sarthakagrawal | Astro 5, React islands, MDX, CF Pages | Standard | Missing | Skip |
| 25 | significanthobbies | Next.js 16, Drizzle, Turso, better-auth, CF Workers, dnd-kit | Standard | Partial (plans/) | Skip |
| 26 | starboard | Next.js 16, Turso (F32_BLOB vector), CF Workers AI embeddings (BGE 768d), NextAuth | Fancy | Missing | Add docs/learning/ — embedding dim contract, OpenNext+@libsql bundling workaround, CF binding vs HTTP fallback, Vercel→CF move |
| 27 | swe-interview-prep | React 19, Vite, CF Pages/Functions, Turso, multi-LLM AI SDK, Monaco, Excalidraw, Go WASM, ts-fsrs | Fancy | Partial (TINYGPT_LEARNING_PATH, RESEARCH_SUMMARY, etc.) | Add docs/learning/ for FSRS impl, Go WASM, multi-provider streaming, Socratic/Feynman grading + DECISIONS.md |
| 28 | taste (ShipRank) | React 19, Vite, Hono, Drizzle, CF Pages/Workers/D1, AI evaluator agents | Fancy | Partial (PROJECT_STATUS) | Add docs/learning/DECISIONS.md — CF+D1 choice, AI-evaluator agent architecture, Hono+Pages integration |
| 29 | **tinygpt** | Swift/MLX, WebGPU/WGSL, C++/WASM SIMD, Python, Rust, Astro, hand-written ML kernels (FA2, LoRA, GQA, RoPE) | Fancy | **Present (extensive)** — docs/learn/{curriculum,journal,sessions 01-08,ane-research,archive}, docs/sessions/{6 dated retros}, docs/{decision_log,lessons,study_guide,learning_roadmap,RETROSPECTIVE,qa_log,progress,status}.md | **REFERENCE STANDARD** |
| 30 | today-little-log | React 19, Vite 8, Drizzle, Turso, better-auth, CF Pages, PWA, AI SDK | Standard | Partial (plans/) | Skip |
| 31 | truehire | Next.js 16, Drizzle, Turso, NextAuth, CF Workers, Octokit | Standard | Partial (decisions.md, retro) | Skip |

## Format change — 2026-06-13

The verbose `decisions.md` + `lessons.md` per project was rejected by the user as too detailed and GPT-flavored. The canonical artifact is now a single short file: `docs/learning/new-things.md` — topic stubs only (3–5 lines each: `What / Why here: TBD / Gotcha / Source`). The user fills in `Why here:` after learning each topic locally via LLMs. Retros and `external-references.md` are kept; the old `decisions.md` / `lessons.md` are moved to `docs/archive/`.

This rule is now in fleet `AGENTS.md` and in memory (`feedback-learning-track`).

All 12 already-scaffolded projects have been condensed to the new format below. Future projects scaffold only the short `new-things.md`.

## Scaffolding progress

| Project | Status | Files written | Notes |
|---------|--------|---------------|-------|
| CodeVetter | ✅ Done | docs/DECISIONS.md (135 lines, 7 ADRs), docs/LESSONS.md (98 lines) | Stale ARCHITECTURE.md found; vestigial automerge dep; dual lockfiles |
| event-forecast | ✅ Done | docs/decisions.md (186 lines, 6 ADRs), docs/lessons.md (160 lines, 9 lessons), docs/learning/external-references.md (106 lines) | 6 TBDs flagged; property-weight constants (0.55/0.25/0.15/0.05) unexplained in code |
| free-ai | ✅ Done | docs/decisions.md (163 lines, 7 ADRs), docs/lessons.md (125 lines, 11 lessons) | 4 TBDs; HealthStateDO doubles as round-robin; eval multiplier capped [0.8, 1.2]; x-gateway-internal header trick |
| high-signal | ✅ Done | docs/decisions.md (330 lines, 11 ADRs), docs/lessons.md (174 lines, 17 lessons), docs/retros/2026-04-25-lab-phase-1.md (98), docs/retros/2026-05-25-daily-brief-reframe.md (102), docs/learning/external-references.md (122 lines) | 7 TBDs; Modal→GitHub Actions pivot in <24h; GLiREL is a stub (graph hand-curated 175 edges); VectorBT never wired; 5-sub-product frame replaced by Daily Brief reframe in <4 weeks |
| personal-memory | ✅ Done | docs/decisions.md (194 lines, 8 ADRs), docs/lessons.md (79 lines, 8 lessons) | 2 TBDs; vault is fully scaffolded but never run — all lessons are design-phase; Obsidian `slash-command` core plugin disabled (slash commands are pure agent specs); no external citations in repo so external-references skipped; no git history so retros skipped |
| port-whisperer | ✅ Done | docs/decisions.md (116 lines, 9 ADRs), docs/lessons.md (95 lines), docs/retros/2026-05-23-stability-phase.md (38), docs/learning/external-references.md (33 lines) | 3 TBDs; clap is a declared dep but never called (hand-rolled flag parser); `ports doctor` subcommand exists entirely for a macOS lsof kernel-hang bug from crashed VPN utun sockets; integration tests originally stampeded `cargo build --release` 21× in parallel; `:80` matched `:8080` regression has dedicated tests |
| researchPapers | ✅ Done | docs/decisions.md (265 lines), docs/lessons.md (177 lines), docs/retros/2026-05-30-postgres-to-clickhouse.md (45), docs/retros/2026-06-13-ram-aware-pipeline.md (45), docs/learning/external-references.md (115 lines) | 1 TBD; `paper_scores_v2` overlay exists because ALTER UPDATE is slow on year-partitioned MergeTree; two PageRank impls coexist (NetworkX/Postgres legacy + scipy.sparse/CH current); MLX HTTP server silently ignores `strict: true` JSON schema; keybert_tag.py never ported from Postgres → dead branch |
| reader | ✅ Done | docs/decisions.md (305 lines, 8 ADRs), docs/lessons.md (186 lines, 18 lessons), docs/retros/2026-04-25-firebase-to-cloudflare.md (52), docs/learning/external-references.md (107 lines) | 3 TBDs; two patch scripts (`patch-opennext.mjs`, `fix-opennext-deps.mjs`) required to deploy — biggest operational fragility; CF Pages experiment lasted <3 hours (Workers→Pages→Workers same day, R2 binding friction); legacy NextAuth tables orphaned after better-auth migration; R2 native binding replaced @aws-sdk same week as paid-plan unlock |
| starboard | ✅ Done | docs/decisions.md (152 lines, 8 ADRs), docs/lessons.md (139 lines, 14 lessons), docs/retros/2026-04-25-vercel-to-cloudflare.md (44), docs/learning/external-references.md (57 lines) | 0 TBDs; AI Gateway sometimes returned 1536d vectors (2× expected) — `normalizeEmbeddingDimensions` averages adjacent pairs, invisible data-corruption window 2026-04-11 → 2026-05-23; `vector_top_k` has no user-scoped filtering (500 global candidates fetched per search); CF Pages attempted and reverted same day with no recorded rationale |
| looptv | ✅ Done | docs/decisions.md (186 lines, 7 ADRs), docs/lessons.md (120 lines), docs/retros/2026-04-28-workers-to-pages.md (46), docs/learning/external-references.md (75 lines) | 2 TBDs; BERT NER replaced by LLM gateway after one day in prod ("too noisy"), but torch deps survive as local fallback; two CF deploy migrations in 3 days (Vercel→Workers→Pages); 3,026 lines of OpenNext scaffolding deleted after pure-static confirmed; `next build --webpack` (Turbopack opt-out) undocumented |
| ai-game | ✅ Done | docs/decisions.md (260 lines, 12 ADRs), docs/lessons.md (189 lines), docs/retros/2026-05-21-phaser-to-r3f.md (48), docs/retros/2026-06-12-single-to-cf-worker.md (56), docs/learning/external-references.md (125 lines) | 3 TBDs (SHARP/PIANO/SOTOPIA citations); 8 existing docs reviewed and linked-from rather than duplicated; phaser still in package.json despite no active Phaser code; DO architecture more sophisticated than expected (same-account service-binding constraint, debounced SQLite persist) |
| email-manager | ✅ Done | docs/decisions.md (220 lines, 9 ADRs), docs/lessons.md (189 lines, 20 lessons), docs/retros/2026-04-25-cf-workers-migration.md (54), docs/retros/2026-06-04-performance-and-landing-rework.md (50), docs/learning/external-references.md (69 lines) | 3 TBDs; CF Pages↔Workers bounced 4 times in one day (2026-04-25); `encodeBody: "manual"` double-gzip bug briefly hit prod (2026-06-05) with no doc; `scripts/cf-build.mjs` pnpm sparse-install workaround is the most fragile build piece, undocumented |

## Condensation to new-things.md format (2026-06-13)

All 12 verbose tracks above were distilled to short topic stubs and the verbose originals archived.

| Project | new-things.md | Topics | Archive | Notes |
|---------|---------------|--------|---------|-------|
| CodeVetter | docs/learning/new-things.md (63 lines) | 10 | docs/archive/DECISIONS.md, LESSONS.md | plain mv (untracked) |
| event-forecast | docs/learning/new-things.md (74 lines) | 9 | docs/archive/decisions.md, lessons.md | plain mv |
| free-ai | docs/learning/new-things.md (65 lines) | 8 | docs/archive/decisions.md, lessons.md | plain mv; dropped non-novel ADRs |
| high-signal | docs/learning/new-things.md (79 lines) | 13 | docs/archive/decisions.md, lessons.md | plain mv |
| personal-memory | docs/learning/new-things.md (64 lines) | 8 | docs/archive/decisions.md, lessons.md | plain mv (whole docs/ untracked) |
| port-whisperer | docs/learning/new-things.md (93 lines) | 11 | docs/archive/decisions.md, lessons.md | plain mv |
| researchPapers | docs/learning/new-things.md (74 lines) | 8 | docs/archive/decisions.md, lessons.md | plain mv |
| reader | docs/learning/new-things.md (63 lines) | 10 | docs/archive/decisions.md, lessons.md | plain mv |
| starboard | docs/learning/new-things.md (81 lines) | 10 | docs/archive/decisions.md, lessons.md | plain mv |
| looptv | docs/learning/new-things.md (58 lines) | 7 | docs/archive/decisions.md, lessons.md | plain mv |
| ai-game | docs/learning/new-things.md (75 lines) | 11 | docs/archive/decisions.md, lessons.md | pre-existing topical docs untouched; cross-linked from stubs |
| email-manager | docs/learning/new-things.md (67 lines) | 11 | docs/archive/decisions.md, lessons.md | pre-existing plans/ + project docs untouched |

All `Why here:` fields are TBD by design — to be filled by the user after learning each topic locally. Retros and `external-references.md` preserved across all projects.

## Remaining-8 scaffolds in new short format (2026-06-13)

Direct scaffolds — no archive needed since these projects never had verbose decisions.md / lessons.md from earlier passes.

| Project | new-things.md | Topics | Real gotchas flagged |
|---------|---------------|--------|----------------------|
| local-ai | docs/learning/new-things.md (49 lines) | 8 | `flushHeaders()` must precede `spawn()` or SSE buffers silently; Gemini uses `inputMode: 'arg'` (stdin never written); `parseStream: null` sentinel bypasses JSONL split |
| open-historia | docs/learning/new-things.md (80 lines) | 10 | JSON fence-strip in turn-parser (LLMs ignore "no markdown" instruction); `storySoFar` omissions = permanent amnesia; Admin1 LOD color inheritance recomputed client-side; OpenNext needs `staticAssetsIncrementalCache` or Beasties CSS inlining is discarded at runtime |
| pace | docs/learning/new-things.md (62 lines) | 10 | Apple FM availability check at every call site; WhisperKit intentionally fails-fast until bridge lands; loopback-guard open problem; speculative-race action-parsing invariant (full planner only, never lite) |
| psi-swarm | docs/learning/new-things.md (63 lines) | 8 | Lighthouse 12 crashes on Node 24 (engines `<24`); INP silently omitted (requires real user input) |
| reel-pipeline | docs/learning/new-things.md (70 lines) | 12 | Workers silent death mid-poll when Python render outlasts 30s CPU budget; only MoneyPrinterTurbo is truly pinned (openshorts/reel-maker float on heads/main); Gemini-generated FFmpeg filter strings eval'd directly (hallucinated filter crashes clip) |
| saas-maker | docs/learning/new-things.md (69 lines) | 12 | DO+Container dual-class naming; AGENTS.md injection truncated at line 220 |
| swe-interview-prep | docs/learning/new-things.md (72 lines) | 12 | FSRS `confidence` proxy diverges from raw R at high stability; Go WASM first-run hits API + lazy-loads from R2; `WebAssembly.Memory.prototype.grow` monkey-patched in worker (OOM → RangeError not tab kill); Monaco Go formatting falls back to built-in (no Prettier Go plugin); Excalidraw only persists zoom/scroll (not full appState); CF Pages Functions needs `@libsql/client/web` at edge |
| taste | docs/learning/new-things.md (56 lines) | 7 | Agents only score their focusAreas subset; AGENT_FIRST_WEIGHTS (0.55) flips on first human prediction (single submission materially reorders); CF Pages strips /api prefix (dual-mount required); D1 has no transactions (persist loop non-atomic) |

## Final tally (2026-06-13)

- 20/20 fancy fleet projects now have `docs/learning/new-things.md` in the canonical short stub format.
- 2 reference standards untouched: `tinygpt`, `knowledgebase` (both have their own richer learning tracks).
- 12 projects also have archived verbose `decisions.md` / `lessons.md` at `docs/archive/`.
- All `Why here:` left TBD by design — user fills after learning each topic locally.
- Fleet `AGENTS.md` rule encodes the convention so future agents auto-maintain.
- `swe-interview-prep/docs/learning-tour/` aggregates the per-project tracks into 3 reading tracks (ml/systems/web-platform) + FSRS deck plan.

## Summary

**31 projects audited.** Counts:
- **Fancy + Missing/Partial — needs a learning track:** 17
- **Fancy + Present — already covered:** 2 (`knowledgebase`, `tinygpt`)
- **Standard — skip:** 12

### Priority queue (Fancy + Missing — highest gap first)
1. **CodeVetter** — Tauri/Rust + multi-LLM, agent replay, synthetic QA. No track at all.
2. **event-forecast** — Rust + custom probabilistic forecaster + TimescaleDB. No track.
3. **free-ai** — multi-LLM router on CF DOs with custom health-scoring. No track.
4. **high-signal** — full ML pipeline (GLiNER/GLiREL/FinBERT/pgvector/VectorBT). No track despite frequent pivots.
5. **personal-memory** — agentic Markdown knowledge graph. No track.
6. **port-whisperer** — Rust systems CLI. No track.
7. **researchPapers** — ClickHouse + MLX + spaCy + PageRank pipeline. No track.
8. **reader** — OpenNext on CF Workers + Turso edge + MV3 extension. No track.
9. **starboard** — libSQL vector embeddings + CF Workers AI binding. No track.
10. **looptv** — HF Transformers NER + yt-dlp pipeline. No track.

### Fancy + Partial (already has some docs, just needs structure)
- **ai-game** — has scattered research docs; consolidate into `docs/learning/`
- **email-manager** — in-browser ONNX embeddings; add DECISIONS.md
- **local-ai** — AI CLI proxy; add DECISIONS.md
- **open-historia** — LLM-as-game-engine; add DECISIONS.md
- **pace** — local VLM/LLM voice agent; add `docs/decisions/` ADRs
- **psi-swarm** — Lighthouse + multi-LLM perf reasoning; add DECISIONS + LESSONS
- **reel-pipeline** — AI video generation; add phase retros
- **saas-maker** — DOs+Containers+Droid; add decisions/ + retros/
- **swe-interview-prep** — FSRS + Go WASM + multi-LLM; add docs/learning/ + DECISIONS.md
- **taste (ShipRank)** — AI evaluator agents; add DECISIONS.md

### Standard — skipped (12)
anime_list, drank, everythingrated, linkchat, rolepatch, sarthakagrawal, significanthobbies, today-little-log, truehire (+ 3 ambiguous: none in this round)

### Reference standards
- **tinygpt** — gold standard. `docs/learn/` curriculum, numbered sessions, dated retros, decision_log, lessons, study_guide, RETROSPECTIVE, qa_log, progress, status.
- **knowledgebase** — also strong: LEARNING.md (decisions + bug postmortems), NOTES.md, SESSION_LOG.md, GROK_FINDINGS.md, WRITEUP.md, LIVE_VERIFICATION.md.

## Notes per project

### 1. ai-game — Fancy / Partial
Browser-playable AI world sim (Aliveville): autonomous LLM-driven NPCs, 3D walkable town, combat, lifelikeness regression probe harness. Stack: TS, React 19, Three.js/R3F, Rapier physics, Phaser 4, Vite, CF Workers + Durable Objects, SSE, Vitest, Playwright, Astro landing.
Existing docs: `ai-dungeon-differentiation.md`, `research-lifelikeness.md`, `local-llm.md`, `probes-design.md`, `web3d-architecture.md`, `archive/init.md`, `archive/agent-town-handoff.md`, `PROJECT_STATUS.md`. No `DECISIONS.md`, `LEARNINGS.md`, or `docs/learning/` dir.
**Action:** Add `DECISIONS.md` (LLM routing, DO for session state, lifelikeness probes, R3F over Phaser); consolidate scattered research docs into `docs/learning/`.

