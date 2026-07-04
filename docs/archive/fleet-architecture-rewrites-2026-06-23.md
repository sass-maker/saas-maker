# Fleet Architecture Rewrites — 2026-06-23

Deep architectural analysis of 8 fleet projects. Each entry includes current
architecture, proposed rewrite, estimated impact, and implementation effort.
Ordered by ROI (impact ÷ effort).

---

## Priority Tier 1 — Do Now (1-2 weeks, 10-100X improvements)

### 1. high-signal: Precomputed Daily Brief Table + Cron
- **Current**: Every `/brief/daily` request runs 5-14 sequential D1 queries,
  loads full `score_runs` table, ranks stocks in-memory
- **Proposed**: Cron Trigger at 07:30 UTC precomputes the entire brief into a
  `daily_brief_snapshots` table. API does 1 lookup. Fallback to live query
  if snapshot missing.
- **Impact**: 200ms → 5ms (40X faster), 10X reduction in DB load
- **Effort**: 4-6 hours
- **Key files**: `workers/api/src/routes/brief.ts`, `packages/db/src/schema.ts`
- **Also**: Materialized hit-rate view (hourly cron) + KV stock ranking cache

### 2. taste: KV Leaderboard Precomputation + Cron
- **Current**: `GET /leaderboard` scans all battles + all votes, computes
  scores in-memory on every request
- **Proposed**: Cron every 60s precomputes leaderboard into KV. API reads
  from KV with D1 fallback.
- **Impact**: 500ms → 10ms (50X faster), eliminates O(battles×votes) scans
- **Effort**: 1 day
- **Key files**: `functions/api/routes/arena.ts`, `wrangler.toml`

### 3. research-papers: FTS5 Keyword Search + Paper Card Materialized View
- **Current**: Keyword search uses `positionCaseInsensitive()` (full table
  scan). `/papers/{id}` joins 4+ overlay tables every request.
- **Proposed**: Add ClickHouse FTS5 index on title+abstract. Create
  `paper_card` materialized view refreshed nightly.
- **Impact**: 100ms → 10ms keyword search (10X), 50ms → 5ms detail page (10X)
- **Effort**: 2-3 days (FTS5) + 3-4 days (materialized view)
- **Key files**: `clickhouse/init/01_schema.sql`, `src/researchpapers/api.py`

### 4. rolepatch: Streaming-First AI Actions
- **Current**: All AI calls use `generateText`/`generateObject` — user waits
  20-30s with zero feedback
- **Proposed**: Switch to `streamText` with progressive UI. User sees first
  content in 2-3s. Add KV caching for parsed resume/JD structures.
- **Impact**: 60-70% reduction in perceived latency, 40-50% token savings
  on re-runs
- **Effort**: 4-6 hours (streaming) + 3-4 hours (KV cache)
- **Key files**: `src/lib/actions/tailor-action.ts`, `src/components/tailor-flow.tsx`

### 5. email-manager: Cursor Pagination + Incremental Sync
- **Current**: `getAllEmails()` loads entire IndexedDB into memory. Re-syncs
  re-embed all emails.
- **Proposed**: IndexedDB cursor-based pagination. Sync checkpoints track
  last sync — only embed new emails.
- **Impact**: O(n) → O(limit) memory, 10-100X faster re-syncs
- **Effort**: 4-5 days (both)
- **Key files**: `src/lib/db.ts`, `src/components/SemanticSearch.tsx`

---

## Priority Tier 2 — Do Soon (2-4 weeks, structural improvements)

### 6. ai-game: Batch Embeddings + Streaming Dialogue + Decoupled Proposals
- **Current**: 5-10 embedding calls per tick (one per NPC). NPC proposals
  block player actions (2-5s latency). Dialogue buffers until coherence
  check passes.
- **Proposed**:
  - Batch all embedding needs per tick into 1-2 API calls
  - Decouple NPC proposals from player actions (immediate response,
    background NPC processing)
  - Stream dialogue tokens immediately, check coherence in background
- **Impact**: 30-50% fewer API calls, 50-70% action latency reduction,
  40-60% dialogue latency reduction
- **Effort**: 7-10 days total (2-3 days per opportunity)
- **Key files**: `src/simulation.ts`, `src/llm/proposer.ts`, `src/dialogue.ts`
- **Future**: Durable Objects for per-game-room state (5-7 days, requires
  Cloudflare Workers migration)

### 7. pace: Event-Driven TTS + Pipelined Observation
- **Current**: 80ms TTS polling loop. 600ms hard sleep before re-screenshot.
  Sequential observe-think-act.
- **Proposed**:
  - Replace TTS polling with Combine completion publisher
  - Start next screen capture while current action executes (async stream)
  - Perceptual hash + block-based diffing for smarter cache hits
- **Impact**: 500-800ms total latency improvement (2.5-3s → 1.7-2s)
- **Effort**: 12-17 hours total
- **Key files**: `CompanionManager+AgentLoop.swift`, `PaceScreenImageDiffer.swift`

### 8. reel-pipeline: Workflows + Parallel Fan-Out + Queue Triggering
- **Current**: Polling watcher (30s interval). Sequential render-pro.js
  (screenshot → caption → metadata, 2-4 min per reel). Custom CDP client.
- **Proposed**:
  - Cloudflare Workflows for durable, retryable pipeline execution
  - Fan-out: screenshot + caption + metadata run in parallel
  - Queue-triggered (webhook → Queue → consumer, no polling)
  - R2 screenshot cache with content hashing
- **Impact**: 40% faster renders, 15-30s less time-to-render, 40% better
  reliability
- **Effort**: 5-7 weeks total (3-4 weeks Workflows, 2-3 weeks fan-out)
- **Key files**: `reel/src/orchestrator.rs`, `scripts/render-pro.js`

### 9. taste: Durable Objects for Arena + Queues for Capture
- **Current**: Synchronous D1 vote writes. Sequential screenshot capture.
- **Proposed**:
  - Durable Object per battle room: in-memory vote tally, periodic D1 flush
  - Queue fan-out: one message per URL, parallel capture workers
  - Workflows for evaluation pipeline with durable steps
- **Impact**: 20X faster votes (5ms vs 100ms), 10X capture throughput
- **Effort**: 7-10 days total
- **Key files**: `functions/api/routes/arena.ts`, `workers/taste-capture/`

---

## Priority Tier 3 — Strategic (1-2 months, enables scaling)

### 10. ai-game: Durable Objects Migration
- **Current**: All game state in Node.js process memory, lost on restart,
  can't scale beyond single server
- **Proposed**: Migrate to Cloudflare Workers + Durable Objects per game
  room. DO holds World state, runs agent loop, persists to DO storage.
- **Impact**: Enables multi-server scaling, persistent state, atomic updates
- **Effort**: 5-7 days
- **Prerequisite**: Deploy to Cloudflare Workers (currently Node.js)

### 11. email-manager: Web Worker Embeddings + WASM SQLite FTS5
- **Current**: Embeddings block main thread. No keyword search (semantic
  only).
- **Proposed**: Move embeddings to Web Worker. Add sqlite-wasm with FTS5
  for hybrid keyword + semantic search.
- **Impact**: Non-blocking UI, 100X faster keyword search, hybrid search
  quality
- **Effort**: 7-12 days

### 12. high-signal: Cloudflare Queues for Signal Generation
- **Current**: Synchronous Python pipeline, one slow adapter blocks all
- **Proposed**: Queue-triggered signal generation, per-entity-cluster
  messages, dead-letter queue for failures
- **Impact**: Resilience, 10X throughput, observability
- **Effort**: 6-8 hours

---

## Cross-Cutting Patterns

These patterns appear across multiple projects and should be standardized:

### Pattern 1: Cron + KV Precomputation
**Applies to**: high-signal, taste, research-papers
Any endpoint that aggregates data on every request should be precomputed
by a Cron Trigger and served from KV. 10-100X latency improvement.

### Pattern 2: Streaming-First AI
**Applies to**: rolepatch, ai-game, pace, taste
Replace `generateText` with `streamText`. Show partial results immediately.
Check quality in background. 60-70% perceived latency improvement.

### Pattern 3: Queue-Based Fan-Out
**Applies to**: reel-pipeline, taste, high-signal, ai-game
Replace sequential processing with Queue-triggered parallel workers.
5-10X throughput improvement.

### Pattern 4: Durable Objects for Stateful Coordination
**Applies to**: ai-game, taste
Replace in-memory state with DO per room/session. Enables scaling,
persistence, atomic updates.

### Pattern 5: Cursor-Based Pagination
**Applies to**: email-manager, any project with list endpoints
Replace `getAll()` with cursor-based pagination. O(limit) instead of O(n)
memory.

### Pattern 6: Batch AI Calls
**Applies to**: ai-game, email-manager, taste
Collect multiple inference/embedding needs, batch into single API call.
30-50% reduction in API calls.

---

## Implementation Order

1. **Week 1**: high-signal precomputed brief + taste KV leaderboard +
  research-papers FTS5 + rolepatch streaming
2. **Week 2**: email-manager cursor pagination + ai-game batch embeddings
3. **Week 3-4**: pace event-driven TTS + ai-game decoupled proposals +
  taste Durable Objects
4. **Week 5-6**: reel-pipeline Workflows + parallel fan-out
5. **Week 7+**: Strategic migrations (DO for ai-game, WASM SQLite for
  email-manager, Queues for high-signal)

---

## Deep Research Findings (8 Reports)

Below are the expanded architectural analyses from the 8 deep research
agents. Each includes concrete platform capabilities, code patterns,
performance estimates, and phased implementation roadmaps.

---

### A. research-papers: Hybrid Search at Scale

**Current**: 488k papers, in-process embedding (sentence-transformers),
ClickHouse cosine similarity, substring LIKE keyword search, 3-query
detail page.

**Proposed**: Three-phase hybrid search architecture:

1. **D1 FTS5 keyword search** (BM25 scoring, 15-30ms)
2. **Vectorize semantic search** (Workers AI embedding, 50-100ms)
3. **Reciprocal Rank Fusion (RRF)** to merge both result sets (k=60)

**Supporting infrastructure**:
- **Incremental embedding pipeline**: Cloudflare Queue (`papers.embed`)
  triggered on new paper ingest. Consumer batches 256 papers, embeds via
  Workers AI (`@cf/baai/bge-base-en-v1.5`), upserts to Vectorize. 30-60s
  from ingest to searchable (vs. batch re-embed).
- **Materialized `paper_cards` table** in D1: Precomputed denormalized
  view (paper + tags + reviews + citations). Cron refreshes hourly.
  Detail page: 3 queries (200ms) → 1 query (10ms).
- **Precomputed `paper_similarities`**: Cron every 6h computes top-10
  similar papers via Vectorize. `/similar/{id}`: 200ms → 10ms.

**Performance**:
| Metric | Current | Proposed | Improvement |
|--------|---------|----------|-------------|
| Keyword search | N/A (LIKE) | 20ms (FTS5) | New capability |
| Semantic search | 150-500ms | 100-200ms | 1.5-2X |
| Hybrid search | N/A | 120-250ms | New capability |
| Paper detail | 200-500ms | 10-30ms | 20X |
| Similar papers | 200-500ms | 10-30ms | 20X |

**Cost**: ~$450/mo (ClickHouse) → ~$150/mo (D1 + Vectorize + Workers),
67% savings at 1M papers.

**Effort**: 8-10 weeks (6 phases), 1-2 engineers.

---

### B. ai-game: Tick-Coordinator Pattern with Batch AI

**Current** (hypothetical baseline): Serial AI calls (1 NPC at a time,
500-1000ms/tick), scattered NPC memory, no tick coordination.

**Proposed**: Three Durable Object types:

1. **GameRoom (DO, per-game)**: Authoritative game state, hibernatable
   WebSocket (1000+ clients), 60Hz tick loop via Alarm, SQLite storage.
2. **TickCoordinator (DO, per-game)**: Collects NPC intents, sends batch
   to Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast` with
   `queueRequest: true`), polls for results, caches in SQLite.
3. **NPCMemory (DO, per-NPC)**: Three-tier memory (STM in KV 60s TTL,
   LTM in D1 + Vectorize, procedural in D1). Weekly synthesis compresses
   20 events → 3-5 insights. Entity resolution: exact → fuzzy (Levenshtein
   ≥0.85) → semantic (cosine ≥0.8).

**Batch AI strategy**:
- Tick N: Collect 50-100 NPC intents
- Tick N+1: Send batch inference request
- Tick N+2: Apply results, broadcast delta
- Latency: 33-50ms (2-3 ticks @ 60Hz) vs. 25-50s serial

**Performance**:
| Metric | Current (Serial) | Proposed (Batch) | Speedup |
|--------|-----------------|------------------|---------|
| Per-tick AI latency | 500-1000ms | 50-100ms | 5-20X |
| Tick rate | 1-2 Hz | 60 Hz | 30-60X |
| Concurrent games | 10-50 | 1000-10000 | 100-200X |
| NPCs per game | 5-10 | 50-200 | 5-20X |

**Cost**: $1650/mo → $650/mo (60% savings) at 1000 concurrent games.

**Effort**: ~2600 lines, 8-10 weeks, 5 phases.

---

### C. reel-pipeline: Workflows + Queues + Browser Rendering

**Current**: Sequential variant rendering, blocking HTTP polling (2s
intervals, 60 attempts), custom CDP client (Node WebSocket + Chrome
spawning), `wrangler r2 object put` subprocess per file.

**Proposed**: Cloudflare Workflows orchestration with parallel fan-out:

1. **ReelIntakeWorkflow**: Orchestrates screenshot + caption + render
   in parallel via `waitForEvent`. 9 steps, each idempotent + retryable.
2. **ScreenshotWorkflow**: Browser Rendering REST API (`/screenshot`)
   with content-aware R2 caching (`screenshots/{slug}/{urlHash}/{viewportHash}.webp`,
   30-day TTL). Cache hit = skip capture entirely.
3. **CaptionWorkflow**: Workers AI Batch API for parallel caption
   generation. SRT file generation + R2 upload.
4. **RenderQueueConsumer**: Queue-triggered, calls existing renderer
   adapters. Result stored in D1, polled by workflow.

**Key platform capabilities used**:
- Workflows: Durable execution, per-step retries (up to 10,000), rollback
  handlers (saga pattern), `waitForEvent` for external triggers, 4500
  concurrent instances.
- Queues: Fan-out pattern, `sendBatch()` doesn't count against 1000
  subrequest limit, at-least-once delivery.
- Browser Rendering: REST API (`/screenshot`, `/pdf`, `/scrape`),
  $0.09/browser-hour, 10 concurrent (Paid).

**Performance**:
| Metric | Current | Proposed | Improvement |
|--------|---------|----------|-------------|
| 3-variant pipeline | 405s (6.75min) | 140s (2.3min) | 65% reduction |
| Polling overhead | 360s wasted | 0s (durable) | Eliminated |
| Screenshot caching | None | Content-aware (30-day) | New |
| Error handling | Manual | Auto retry + rollback | New |
| Scalability | Single machine | 4500 concurrent | New tier |

**Cost**: $0.16 → $0.17 per reel (+6%, but -65% latency).

**Effort**: 6-8 weeks (4 phases), Large.

---

### D. email-manager: SQLite WASM + Web Worker Embeddings

**Current**: IndexedDB with `getAllEmails()` (loads entire DB),
Transformers.js on main thread (50-100ms/email, UI freezes), O(n)
cosine similarity scan, no FTS5.

**Proposed**: Local-first architecture with two Web Workers:

1. **Database Worker** (SQLite WASM via OPFS):
   - `emails` table with `embedding_status`, `content_hash`, `embedding BLOB`
   - `emails_fts` FTS5 virtual table (subject, from, body) with triggers
   - Cursor-based pagination (`LIMIT/OFFSET` or cursor)
   - Sub-millisecond queries, 10K+ records

2. **Embedding Worker** (Transformers.js, q8 quantization):
   - Batch embedding (10-50 texts at once)
   - Transferable buffers (no copy overhead)
   - Progress callbacks for real-time UI
   - 5-10ms/email (vs. 50-100ms main thread)

3. **Hybrid search**: FTS5 (precision) + semantic (recall) + RRF fusion

4. **Incremental sync**: `content_hash` change detection. Only embed
   `WHERE embedding_status = 'pending'`. 50s → 1s for 10 new emails.

5. **Virtual scroll**: 10 visible items + 5 buffer. Constant memory
   regardless of mailbox size.

**Performance**:
| Operation | Current | Proposed | Speedup |
|-----------|---------|----------|---------|
| Embed 500 emails | 50s (UI frozen) | 5s (progress bar) | 10X |
| Search 1000 emails | 200-500ms | <100ms | 5X |
| Scroll 1000 items | Jank | 60fps | Smooth |
| Incremental sync (10 new) | 50s | 1s | 50X |
| DOM nodes | 500 | 10 (virtual) | -98% |

**Trade-off**: +850KB bundle (WASM). Worth it for 500+ emails.

**Effort**: 40-50 hours, 6 phases (6 weeks).

---

### E. taste: Durable Objects Arena + Workflows + Queues

**Current**: Synchronous D1 vote writes (40-50ms), on-demand leaderboard
(O(N votes) scan, no indexes), sequential screenshot capture (5 URLs/batch),
monolithic evaluation pipeline.

**Proposed**: Edge-native real-time evaluation system:

1. **ArenaRoom (Durable Object, per-battle)**:
   - In-memory vote tally + ELO ratings
   - SSE streaming to connected clients
   - Async D1 flush (every 10s or 50 votes)
   - Incremental ELO update on each vote (O(1) vs. batch O(N))
   - SQLite storage for durability

2. **Leaderboard Precompute (Cron + KV)**:
   - Cron every 30s aggregates votes, computes ELO, writes to KV
   - `GET /leaderboard` reads from KV (<1ms vs. 100-200ms)
   - 30s staleness (acceptable for leaderboard)

3. **EvaluationPipeline (Workflow)**:
   - 7 steps: load study → dispatch captures → wait → run agents
     (parallel) → compute agreement (streaming) → generate report →
     persist + notify
   - Each step idempotent + independently retryable
   - `waitForEvent` for capture completion

4. **Capture Queue (fan-out)**:
   - One message per URL, parallel consumer workers
   - `@cloudflare/puppeteer` with desktop + mobile viewports
   - R2 upload with 1-year immutable cache
   - Dead letter queue for permanent failures

**Performance**:
| Metric | Current | Proposed | Improvement |
|--------|---------|----------|-------------|
| Vote ingestion | 40-50ms (D1) | <5ms (in-memory) | 8-10X |
| Leaderboard read | 100-200ms (D1) | <1ms (KV) | 100-200X |
| Leaderboard staleness | 1-5 min | 30s | 2-10X fresher |
| Capture throughput | 5/batch sequential | 100+/min parallel | 10-20X |
| Evaluation resilience | No retry | Auto retry per step | 100% durable |

**Cost**: ~$50/mo → ~$60/mo (+$10, negligible for 8-200X perf gains).

**Effort**: 8-12 weeks (4 phases), Large.

---

### F. pace: Event-Driven TTS + Pipelined Observation

**Current**: 80ms TTS polling loop, 600ms hard sleep before
re-screenshot, sequential observe-think-act cycle, full-frame diffing.

**Proposed**:
1. **Event-driven TTS**: Replace polling with Combine completion
   publisher. TTS completion fires event → immediately start next
   observation. Eliminates 80ms × N polling overhead.
2. **Pipelined observation**: Start next screen capture while current
   action executes. Overlap I/O-bound (screenshot) with compute-bound
   (VLM reasoning).
3. **Perceptual hash + block-based diffing**: pHash for quick similarity
   check. 16x16 block diff for localized change detection. Skip VLM
   call if <5% pixels changed.
4. **JPEG quality tuning**: Quality 75 vs. 85 for screenshots. 40%
   smaller → faster VLM inference.

**Performance**: 2.5-3s → 1.7-2s per cycle (500-800ms improvement).

**Effort**: 12-17 hours total.

---

### G. high-signal: Precomputed Brief + KV Facets + Queues

**Current**: `/brief/daily` runs 5-14 sequential D1 queries, loads full
`score_runs` table, ranks stocks in-memory. Synchronous Python signal
pipeline (one slow adapter blocks all).

**Proposed**:
1. **Precomputed daily brief**: Cron at 07:30 UTC writes entire brief
   to `daily_brief_snapshots` table. API does 1 lookup. 200ms → 5ms.
2. **Materialized hit-rate view**: Hourly cron maintains
   `signal_hit_rate` materialized view. Eliminates per-request aggregation.
3. **KV stock ranking cache**: Top-100 stocks by score cached in KV
   with 5-min TTL. 50ms → 5ms.
4. **Cloudflare Queues for signals**: Per-entity-cluster messages,
   dead-letter queue for failures. 10X throughput, observability.

**Effort**: 4-6 hours (brief) + 6-8 hours (queues).

---

### H. rolepatch: Streaming-First AI + KV Caching

**Current**: `generateText`/`generateObject` — user waits 20-30s with
zero feedback. Re-runs re-parse resume/JD from scratch.

**Proposed**:
1. **Streaming-first**: `streamText` with progressive UI. First content
   in 2-3s. Quality check in background. 60-70% perceived latency
   reduction.
2. **KV caching**: Cache parsed resume/JD structures by content hash.
   40-50% token savings on re-runs.
3. **Multi-pass generation**: First pass = draft. Second pass = refine
   with ATS scoring. Progressive quality.
4. **Background scraping**: Queue-triggered LinkedIn/indeed scraping
   while user fills form. Data ready by submit time.

**Effort**: 4-6 hours (streaming) + 3-4 hours (KV cache).

---

## Expanded Cross-Cutting Patterns

### Pattern 7: Reciprocal Rank Fusion (RRF)
**Applies to**: research-papers, email-manager
Merge keyword (BM25) + semantic (vector) results with formula
`score = 1/(k + rank)`, k=60. Papers in both lists get score boost.
2-3X precision improvement over either method alone.

### Pattern 8: Three-Tier Agent Memory
**Applies to**: ai-game, any agent system
- STM (KV, 60s TTL): Recent events, current conversation
- LTM (D1 + Vectorize, 30 days): Synthesized insights, relationships
- Procedural (D1, permanent): Tool stats, reasoning traces
Weekly synthesis compresses STM → LTM (20 events → 3-5 insights).

### Pattern 9: Content-Aware Caching
**Applies to**: reel-pipeline, any screenshot/render pipeline
Cache key = `hash(normalizeUrl(url)) + hash(viewport)`. Same URL +
viewport = cache hit. 30-day TTL. Eliminates redundant captures.

### Pattern 10: Saga Pattern with Rollback Handlers
**Applies to**: reel-pipeline, taste evaluation
Each Workflow step has a rollback handler. If step N fails, steps 1..N-1
roll back (delete uploaded files, revert DB writes). Ensures clean
state on failure.

### Pattern 11: Incremental ELO / Online Learning
**Applies to**: taste, any ranking system
Update ratings on each event (O(1)) vs. batch recomputation (O(N)).
K-factor decreases with experience (40 → 24 → 10). Real-time feedback
improves engagement.

### Pattern 12: Hibernatable WebSockets
**Applies to**: ai-game, taste
DOs with hibernatable WebSockets sleep while maintaining connections.
90%+ cost reduction for idle games/arenas. Connection state preserved
across hibernation cycles.
