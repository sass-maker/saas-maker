# Fleet-Wide Performance Opportunities — 2026-06-23

Investigation across all 28 fleet products. Each project was inspected by a
dedicated agent that read real source (file:line citations), verified query
patterns, and ranked findings by magnitude × confidence × (1/risk).

This is the **complete, expanded** report — every finding from every agent
(7-10 per project, ~240 total items), plus cross-fleet patterns and a ranked
quick-wins table.

## How to read this

- **Magnitude** is the agent's grounded estimate for the *specific scenario*
  cited (e.g. "10-50X for 1000+ rows"), not a universal claim.
- **Effort**: S = hours, M = days, L = week+.
- **Risk**: Low / Medium / High — read the per-item note.
- **Confidence**: the agent verified the cited code path. Items marked
  "verify" warrant a quick re-check before implementation because the
  magnitude depends on data scale that may not yet exist.

---

## Cross-Fleet Patterns (do these everywhere)

These recur across 5+ projects. Treating them as fleet standards yields more
than fixing one repo at a time.

### P1. Missing composite indexes on hot filter columns
**Projects:** anime-list, everythingrated, karte, saas-maker, significanthobbies,
starboard, swe-interview-prep, taste, today-little-log, truehire, verified-bases,
research-papers.

Every Drizzle/Turso/D1/ClickHouse project has at least one hot query path doing
a full table scan because the foreign key or filter column lacks a composite
index covering the actual WHERE + ORDER BY. The fix is mechanical (one migration
per repo) and yields 5-100X on the affected queries.

**Fleet action:** add a `pnpm fleet:check-indexes` (or equivalent) sweep that
flags `WHERE col = ?` / `ORDER BY col` pairs missing a matching index. Single
standard, applied per repo.

### P2. N+1 query patterns (loop + await per item)
**Projects:** anime-list, everythingrated, high-signal, karte, knowledge-base,
open-historia, reader, saas-maker, significanthobbies, starboard,
swe-interview-prep, taste, truehire, ai-game.

The single most common high-ROI bug class. `for (item of items) { await
getRelated(item.id) }` instead of `inArray(...)` / JOIN / batch. Yields 10-100X
on list/detail pages.

**Fleet action:** add an ESLint/Drizzle lint rule or code-review checklist item
banning `await inside for...of` over DB rows without explicit batching.

### P3. Missing edge cache / ISR on read-heavy routes
**Projects:** high-signal, looptv, materia, open-historia, rolepatch,
significanthobbies, truehire, verified-bases, today-little-log, saas-maker.

Static or slowly-changing content served with `no-store` or no `Cache-Control`,
forcing a Worker + DB round-trip on every page view. Adding `s-maxage` /
`revalidate` / a `_headers` file yields 10-100X on repeat visits with ~5 lines.

**Fleet action:** standardise a `_headers` template for Pages projects and a
`revalidate` default for Next.js routes that don't need per-request freshness.

### P4. No result caching for deterministic AI calls
**Projects:** free-ai, knowledge-base, rolepatch, reader, ai-game, high-signal,
tinygpt.

Identical prompts / embeddings re-computed on every request. KV-cached by
content hash → 50-100X on cache hit, 0 cost on miss.

**Fleet action:** ship a shared `cacheableEmbed()` / `cacheableComplete()`
helper in a fleet package (saas-maker or free-ai) that all projects import.

### P5. Unvirtualised large lists in React
**Projects:** drank, email-manager, reader, saas-maker, codevetter,
research-papers, swe-interview-prep.

Lists of 100-1000+ items rendered as full DOM. `react-window` /
`@tanstack/react-virtual` → 5-50X render + scroll perf.

**Fleet action:** add a `<VirtualList>` fleet primitive and a perf lint that
flags `.map(>50 items)` without virtualisation.

### P6. Sequential external API calls that could be parallel
**Projects:** drank, email-manager, pace, reel-pipeline, starboard, rolepatch,
truehire, high-signal, ai-game.

`for (x of xs) await fetch(x)` where the calls are independent. `Promise.all`
with a small concurrency cap → 3-10X.

**Fleet action:** document a `pLimit`-based concurrency helper in fleet-ops
and reference it in AGENTS.md.

### P7. Repeated JSON parse/stringify in hot paths
**Projects:** ai-game, open-historia, taste, drank, today-little-log,
swe-interview-prep.

Large JSON payloads re-parsed/re-serialised on every render, tick, or state
change. Memoise, cache, or move to structured data.

### P8. Polling loops where event-driven would suffice
**Projects:** pace (TTS, permissions, LM Studio), codevetter (session indexer).

Fixed-interval polling for state that rarely changes. Event-driven or
adaptive backoff → 5-20X CPU/overhead reduction.

### P9. Missing R2/asset cache headers on immutable blobs
**Projects:** looptv, open-historia, taste, verified-bases.

R2 objects and static JSON served without `Cache-Control: immutable`. One
header → 10-100X repeat loads.

### P10. Subprocess / per-request resource creation
**Projects:** research-papers (subprocess per embedding), verified-bases
(`sql.Open` per request, new `http.Client` per call), reel-pipeline (Chrome
process per screenshot).

Resources that should be pooled/singletons are created per request. Pooling
→ 5-50X.

---

## Per-Project Complete Findings

### ai-game (10 findings)
1. **JSON.parse(JSON.stringify) world clone in hot paths** — sim.ts:89,
   agent-loop.ts:199. 10-50X checkpoint capture. Effort M, Risk Med.
2. **Unbatched embeddings in dialogue** — sim.ts:1089. 40 sequential embed
   calls/turn → 1 batched. 10-40X. Effort S, Risk Low.
3. **N+1 NPC lookups in combat/move loops** — sim.ts:1216+. O(n²) `.find()`
   per tick → `Map<id>`. 10-100X. Effort S, Risk Low.
4. **Redundant full-world fetch on every SSE tick** — web3d/store/world.ts:156.
   Apply tick deltas client-side. 10-15X bandwidth. Effort M, Risk Med.
5. **Checkpoint cloning blocks event loop** — agent-loop.ts:185. 5-10X tick
   loop. Effort M, Risk Med.
6. **Repeated memory filtering in dialogue** — dialogue.ts:333. 2 full scans
   per turn. Pre-compute indices. 5-10X. Effort S, Risk Low.
7. **Worldgen cache key via JSON.stringify** — cache.ts:10. Hash instead.
   10-20X. Effort S, Risk Low.
8. **Unbatched embeddings in proposer** — proposer.ts:21. 5 separate embed
   calls → 1. 5X. Effort S, Risk Low.
9. **Missing dialogue history pagination** — dialogue.ts:12. Circular buffer.
   10-20% payload. Effort S, Risk Low.
10. **Unoptimised memory retrieval in proposer** — proposer.ts:83. Cache
    `recentKeywords` per tick. 3-5X. Effort S, Risk Low.

### anime-list (8 findings)
1. **N+1 in public collections endpoint** — worker.ts:1388. 50 sequential
   `getAnimeByMalId` → Map lookup. 10-50X. Effort S, Risk V.Low.
2. **Missing (season, year) composite index** — migrations.ts:330. Discover
   queue full-scans 14.8k rows. 50-100X. Effort S, Risk V.Low.
3. **Full-column SELECT in getAllAnime** — animeData.ts:220. Fetches synopsis
   etc. for filter-only paths. 30-50% payload. Effort M, Risk Low.
4. **Dismissals index verification** — watchlist.ts:179. Verify index is used.
   5-10X. Effort S, Risk V.Low.
5. **Multi-pass discover filtering** — worker.ts:1177. 4 passes → 1. 20-30%.
   Effort M, Risk Low.
6. **Missing React Query staleTime/gcTime** — FilterBuilder.tsx:285. 30-50%
   fewer API calls. Effort S, Risk V.Low.
7. **Image lazy loading missing** — WatchlistView.tsx:560. `loading="lazy"`.
   20-40% LCP. Effort S, Risk V.Low.
8. **getUserTags JOIN + GROUP BY** — watchlist.ts:214. 5-15X for 500+ items.
   Effort M, Risk Low.

### codevetter (10 findings)
1. **Streaming LLM responses for progressive UI** — review.rs:727. Time-to-
   first-finding 8s → 0.3s. 30-50X perceived. Effort M, Risk Low.
2. **Batch diff parsing + metadata caching** — review.rs:1100. 2 git calls →
   1, cache parsed diff. 10-20X. Effort S, Risk Low.
3. **Incremental blast-radius cache** — blast_radius.rs. Cache symbol→callers
   in SQLite. 5-15X. Effort M, Risk Med.
4. **Parallel history context collection** — git.rs:750. 5 sequential →
   JoinSet. 3-5X. Effort S, Risk Low.
5. **Lazy-load findings with virtualisation** — QuickReview.tsx:1421. 200 → 20
   rendered. 10-50X. Effort M, Risk Low.
6. **Memoise evidence pattern candidates** — evidence_pattern.rs:90. Cache
   structural matches. 2-3X. Effort M, Risk Low.
7. **Deduplicate file reads in proof export** — review-proof.ts. Cache file
   content during export. 3-10X. Effort S, Risk Low.
8. **Adaptive session indexing** — history.rs:147. Adaptive interval based
   on growth rate. 2-3X CPU. Effort S, Risk Low.
9. **Compress large diffs in DB** — schema.rs. zstd BLOB. 5-10X compression.
   Effort M, Risk Low.
10. **Parallel specialists + streaming aggregation** — review.rs:1282. Start
    coordinator after first 2 specialists. 20-40%. Effort M, Risk Med.

### drank (8 findings)
1. **Sequential domain refreshes** — useTrackedDomains.ts:218. 750ms delay ×
   N → batched concurrent. 10-50X for 50 domains. Effort S, Risk Low.
2. **Memoize getWeeklyChange** — page.tsx:444. Full history sort per card per
   render. 5-20X. Effort S, Risk Low.
3. **Cache global data fetch** — page.tsx:99. `no-store` on immutable GitHub
   raw. 2-5X repeat visits. Effort S, Risk V.Low.
4. **Virtualise history table** — page.tsx:838. 500 rows in 220px container.
   10-50X for 100+ points. Effort M, Risk Low.
5. **Favicon loading waterfall** — utils.tsx:327. 55 serial requests. Cache +
   parallel. 2-20X. Effort M, Risk Low.
6. **React.memo domain cards** — page.tsx:444,662. 45 cards re-render on any
   state change. 3-10X. Effort M, Risk Low.
7. **Web Worker for large JSON import** — utils.tsx:211. 5-50X for 500KB+.
   Effort M, Risk Low.
8. **(false positive — leaderboard already memoised)** — N/A.

### email-manager (9 findings)
1. **Sequential embedding generation** — SemanticSearch.tsx:87. 1 email at a
   time → batch 5-10. 5-10X. Effort M, Risk Low.
2. **Full IndexedDB scan on every semantic search** — semantic-search.ts:20.
   Loads all emails, scores in JS. ANN index → 10-50X. Effort M-L, Risk Med.
3. **No incremental sync** — HomeClient.tsx:127. Re-fetches all 500 every
   time. `after:` query + checkpoint → 10-100X. Effort M, Risk Low.
4. **Metadata-only initial fetch** — gmail.ts:156. Full bodies for embed
   triage. 10X initial sync. Effort S, Risk Low.
5. **IndexedDB index on embedding field** — db.ts:51. 10-100X for large
   mailboxes. Effort S, Risk Low.
6. **No render virtualisation for email list** — EmailList.tsx:174. 500 DOM
   nodes. 5-10X scroll. Effort M, Risk Low.
7. **Re-computation in analytics/filter builder** — Analytics.tsx:104,
   GmailFilterBuilder.tsx:41. Memoise by bucket size. 2-5X. Effort S, Risk Low.
8. **Embedding model reload on remount** — embeddings.ts:1. Preload on app
   startup. 2-5X first search. Effort S, Risk Low.
9. **Bundle: unused transformers in worker** — worker.ts. Verify external
   config. 5-10% bundle. Effort S, Risk Low.

### everythingrated (7 findings)
1. **Full-table ratings scan in aggregation** — ratings.ts:219,245; stack.ts:36.
   `db.select().from(ratings)` then JS filter. SQL `inArray` → 10-50X. Effort
   S, Risk Low.
2. **Missing partial index on superseded_at** — schema.ts:115. 5-20X. Effort
   S, Risk Low.
3. **N+1 in topItemsByAspectKey** — ratings.ts:41. 3 full tables + O(n²) JS.
   SQL JOIN+GROUP BY → 20-100X. Effort M, Risk Med.
4. **Sequential duplicate detection** — item-submissions.ts:163. 6 round-trips
   → 2. 3-5X. Effort M, Risk Low.
5. **Missing index on itemSubmissions.directoryId** — schema.ts:172. 2-5X.
   Effort S, Risk Low.
6. **Cascading revalidatePath calls** — actions.ts:50. `revalidateTag` instead.
   2-10X. Effort M, Risk Med.
7. **Inefficient visitor count check** — actions.ts:35. Full scan + count →
   LIMIT 1. 2-3X. Effort S, Risk Low.

### forecast-lab (10 findings)
1. **Redundant model fitting in replay** — replay.rs:93. `fit_model` per step
   (~2880 fits). Cache/incremental → 10-50X. Effort M, Risk Med.
2. **Linear bucket lookup in heatmap** — location.rs:109. O(n) per bucket →
   HashMap index. 10-100X. Effort S, Risk Low.
3. **Quadratic bucket dedup** — lib.rs:511. `Vec::contains` in loop →
   HashSet. 10-100X. Effort S, Risk Low.
4. **Double evaluation in action report** — lib.rs:854. `attach_forecast_quality`
   re-fits model. Pass fitted model in. 2-5X. Effort S, Risk Low.
5. **Missing DB index on entity_id** — migrations:18. Partial index. 5-50X.
   Effort S, Risk Low.
6. **Sequential replay evaluation** — replay.rs:106. 2880 evaluations. Cache
   by (history_count, ratio). 10-100X. Effort M, Risk Med.
7. **Linear property value lookup** — lib.rs:452. `Vec::contains` → HashSet.
   10-50X. Effort S, Risk Low.
8. **Missing result caching for static endpoints** — main.rs:207. 10-100X
   repeat explorer loads. Effort M, Risk Low.
9. **Excessive cloning in endpoints** — main.rs:345,373,453. `fit_model`
   takes `Vec<Event>` by value. Borrow instead. 2-10X. Effort S, Risk Low.
10. **Inefficient property_string extraction** — lib.rs:432. Called millions
    of times. Pre-extract. 2-5X. Effort M, Risk Med.

### free-ai (8 findings)
1. **Embedding request caching (KV)** — index.ts:2096. 50-100X on cache hit
   for RAG. Effort M, Risk Low.
2. **Request coalescing for concurrent identical embeds** — index.ts:2096.
   10-50X on bursts. Effort M, Risk Low.
3. **Health snapshot cache per request** — index.ts:1289,3080. 2-3X per req,
   8-10X /models. Effort S, Risk Low.
4. **Model registry parsed every request** — config.ts:1465. Module-level
   cache → 100X fewer parses. Effort S, Risk V.Low.
5. **Analytics batch writes to D1** — index.ts:1023. 50-100X fewer
   transactions. Effort M, Risk Low.
6. **SSE token buffering** — index.ts:1420. 1 token/frame → batch 5-10.
   5-10X fewer frames. Effort M, Risk Low.
7. **Parallel provider candidate fetching** — index.ts:3069. Group by
   provider. 3-5X /models. Effort S, Risk V.Low.
8. **Quota cache TTL extension + background refresh** — quota.ts:35. 300s →
   1800s + background. 80-90% fewer API calls. Effort S, Risk Low.

### high-signal (8 findings)
1. **Edge cache + ISR for /brief/daily** — brief.ts, route.ts. `no-store` on
   precomputed daily brief. 10-50X anonymous. Effort M, Risk Low.
2. **Pre-compute hit-rate stats** — brief.ts:358. Full `score_runs` scan per
   request → KV cached. 20-100X. Effort M, Risk Low.
3. **Batch perception/improvements queries** — brief.ts:511. 8-12 → 2-3
   queries. 3-5X. Effort S, Risk Low.
4. **Concurrent signal generation** — pipeline.py:388. Sequential LLM calls
   → ThreadPoolExecutor. 4-8X. Effort M, Risk Med.
5. **Cache facet aggregates** — signals.ts:87. 5 queries + 500 enrichments →
   KV. 10-50X. Effort S, Risk Low.
6. **DB-level ranking for stocks** — brief.ts:279. Overfetch 4x + in-memory
   sort → ORDER BY in SQL. 2-3X. Effort S, Risk Low.
7. **Increase per-host concurrency** — pipeline.py:327. 1 → 2-3 per host.
   2-3X. Effort S, Risk Med.
8. **Cache seed product lookups** — brief.ts:221. Map + KV. 1-2X. Effort S,
   Risk Low.

### karte (8 findings)
1. **Missing FK indexes (links.pageId etc.)** — schema.ts:98. 5-20X profile
   load. Effort S, Risk Low.
2. **Redundant profile queries in chat** — profile-memory.ts:177, chat route.
   Re-fetches data already loaded. 2-3X. Effort M, Risk Low.
3. **OG image cache too short** — api/og/route.tsx. 5min → 1hr. 20-50% CPU.
   Effort S, Risk Low.
4. **In-memory rate limiter resets on deploy** — rate-limit.ts. DO/KV-backed
   → 10-100X abuse protection. Effort M, Risk Med.
5. **ChatWidget bundle not split** — chat-widget.tsx. 15-25% FCP. Effort M,
   Risk Low.
6. **Chat route redundant page lookups** — api/chat/route.ts:58,130. Join
   page+user. 2-3X. Effort M, Risk Low.
7. **Avatar loading unoptimised** — profile-avatar.tsx. Preload + WebP.
   10-30% LCP. Effort S, Risk Low.
8. **Missing selective column queries** — dashboard pages. 5-10% transfer.
   Effort S, Risk Low.

### knowledge-base (9 findings)
1. **Lexical chunk full-scan scoring** — index.ts:5363. Loads 5000 chunks,
   BM25 in JS. Use existing `searchLexicalChunks` D1 method → 10-50X. Effort
   M, Risk Low.
2. **Sequential embedding in ingest** — index.ts:3146. Per-doc embed → batch
   all chunks. 5-10X. Effort M, Risk Low.
3. **Chunk hydration N+1 (Vectorize metadata ignored)** — index.ts:5348.
   Metadata already has content; re-fetches from D1. 2-5X. Effort S, Risk Low.
4. **Unbatched vector upserts** — index.ts:3106. Per-doc upsert → batch. 5-
   10X. Effort M, Risk Low.
5. **Entity filter full load (500)** — index.ts:2046. DB-level filter → 5-20X.
   Effort M, Risk Med.
6. **Graph entity full load (500)** — index.ts:2097. Targeted ID query → 5-
   10X. Effort S, Risk Low.
7. **Multiple query variant embeddings** — index.ts:2571. Batch variant
   embeds. 2-3X. Effort M, Risk Low.
8. **Expensive cache key serialization** — index.ts:2870. Simplify key. 1-2X.
   Effort S, Risk Low.
9. **Query stream doesn't stream retrieval** — index.ts:4939. Waits for full
   answer before SSE. Stream stages. 2-3X perceived. Effort L, Risk Med.

### looptv (7 findings)
1. **Missing HTTP cache headers on catalog.json** — wrangler.toml. 500KB-1MB
   re-fetched every load. `_headers` file → 10-100X repeat visits. Effort S,
   Risk V.Low.
2. **Smart Mix O(n) filter on 38k videos per play** — smartmix.ts:41. Memoise
   + index. 20-50X. Effort M, Risk Low.
3. **Redundant catalog flattening (3x/render)** — TVApp.tsx:226,449,515.
   useMemo. 5-10X. Effort S, Risk V.Low.
4. **Search rescores 38k videos per keystroke** — Search.tsx:33. Title prefix
   index. 5-20X. Effort M, Risk Low.
5. **localStorage parse/stringify per action** — watched.ts. In-memory cache
   + debounce. 5-10X. Effort M, Risk Low.
6. **Next video preview effect over-triggers** — TVApp.tsx:360. 10 deps →
   2-3. 3-5X. Effort S, Risk V.Low.
7. **No preload of next video** — Player.tsx:218. `cueVideoById`. 1-2X Next
   button. Effort S, Risk Low.

### materia (7 findings)
1. **Full remedies scan per condition page** — graph.ts:39. 207 remedies × 77
   conditions at build time. Reverse index → 50-100X. Effort S, Risk Low.
2. **N+1 in getStudyCitedBy** — graph.ts:105. 36k iterations/study. Reverse
   index → 10-50X. Effort S, Risk Low.
3. **Unindexed compound/study lookups** — graph.ts:95. 12k iterations/compound.
   30-50X. Effort S, Risk Low.
4. **Unoptimised compound resolution in checker** — graph.ts:133. 414
   `getEntries()` → 1 batch. 5-10X. Effort S, Risk Low.
5. **3D mesh mapping per pointer-move** — ThreeBody.tsx:362. Precompute
   keyword index. 3-10X. Effort M, Risk Low.
6. **Inline search index JSON payload** — search.astro:45. 15-25KB inline.
   External `.json`. 20-30% LCP. Effort M, Risk Low.
7. **Linear search in PartPanel** — PartPanel.tsx:21. `.find()` → `Map`.
   10-24X. Effort S, Risk V.Low.

### open-historia (9 findings)
1. **N+1 province lookups in map rendering** — MapView.tsx:356. O(n²) `.find()`
   on 5000 provinces. Map → 10-50X. Effort S, Risk Low.
2. **Missing cache headers on static map assets** — worker.ts:41. 2-5MB JSON
   re-fetched. 10-100X repeat visits. Effort S, Risk Low.
3. **Sequential province lookups in turn processing** — useTurnProcessing.ts:175.
   3× `.find()` per update. Normalised map → 5-20X. Effort S, Risk Low.
4. **Unbatched DB inserts in save upload** — saves.ts:267. 1 per save → batch.
   5-10X. Effort M, Risk Med.
5. **GeoJSON rebuild on every relation change** — MapView.tsx:513. Separate
   war tracking. 2-5X. Effort M, Risk Med.
6. **Relation filtering O(n) per update** — useTurnProcessing.ts:244. Map-
   based. 2-5X. Effort S, Risk Low.
7. **Geopolitical context not cached** — ai-prompts.ts:75. Memoise by era.
   1.5-3X. Effort S, Risk Low.
8. **Sync JSON parse in save upload** — saves.ts:224. Skip if denormalised
   fields available. 2-5X. Effort M, Risk Med.
9. **Province name compression regex per name** — ai-prompts.ts:34. Pre-
   compute groupings. 3-10X. Effort M, Risk Med.

### pace (8 findings)
1. **Hardcoded 350ms cursor settle** — AgentLoop.swift:1455. Signal-based
   completion → 10-50X latency on common cases. Effort S, Risk Low.
2. **Hardcoded 600ms post-action screenshot delay** — AgentLoop.swift:1614.
   Visual-diff polling → 5-10X. Effort M, Risk Low.
3. **TTS busy-wait polling (80ms)** — AgentLoop.swift + others (11 sites).
   Async completion signal → 5-10X CPU. Effort M, Risk Low.
4. **Permission polling every 1.5s** — PrivateBindings.swift:18. 30s or
   event-driven → 10-20X overhead. Effort S, Risk Low.
5. **LM Studio reachability polling every 5s** — PrivateBindings.swift:30.
   Failure-driven → 6-12X. Effort S, Risk Low.
6. **JPEG compression factor 0.8** — ScreenCaptureUtility.swift:99. → 0.6.
   2-3X encoding. Effort S, Risk Low.
7. **VLM calls serialized when AX fails** — PaceScreenContextService.swift:468.
   Parallel AX + VLM. 2-5X. Effort M, Risk Low.
8. **VLM batching for multi-monitor** — PaceScreenContextService.swift:503.
   Multi-image request. 2-3X. Effort M, Risk Med.

### reader (8 findings)
1. **In-memory full-text search (FTS5 migration)** — articles-db.ts:728.
   Regex over all articles. FTS5 → 10-100X for 100+ articles. Effort M, Risk
   Med.
2. **Duplicate tag aggregation (N+1)** — articles-db.ts:573. Fetches all,
   O(n²) dedup. SQL GROUP_CONCAT + cache → 10-50X. Effort S, Risk Low.
3. **Article list no virtualisation** — HomeClient.tsx:672. 500+ cards.
   react-window → 5-20X. Effort M, Risk Med.
4. **PDF download no range/streaming** — pdf.ts:90. Full buffer, no ETag.
   5-50X for 10MB+ PDFs. Effort M, Risk Med.
5. **Summary fetch full load + JS filter** — articles-db.ts:367. SQL WHERE
   on listId → 5-20X. Effort M, Risk Low.
6. **Board node hydration not memoised** — BoardCanvasClient.tsx:54. useMemo.
   2-5X. Effort S, Risk Low.
7. **AI chat persistence chatty** — NotesAIChat.tsx:245. Full array per
   debounced save. Delta + batch. 3-10X. Effort S, Risk Low.
8. **Missing embedding cache for AI summaries** — ai-cloudflare.ts:96. Cache
   embeddings. 10-100X repeated. Effort L, Risk High.

### reel-pipeline (10 findings)
1. **Per-frame Chrome process spawn** — render-pro.js:499. 35+ Chrome
   invocations/scene. CDP session pool + caption PNG cache → 5-10X. Effort
   M, Risk Low.
2. **Sequential variant rendering** — render-pro.js:378. v1→v2→v3 → parallel.
   2-3X. Effort M, Risk Med.
3. **Sequential SaaS Maker PATCHes** — marketing.rs:106. 10 round-trips →
   batch. 5-10X. Effort S, Risk Low.
4. **CPU-only FFmpeg encoding** — render-pro.js:312. libx264 → Metal/NVENC.
   3-10X. Effort M, Risk Med.
5. **Sequential R2 uploads via wrangler CLI** — publisher.rs:73. S3 SDK +
   parallel multipart → 3-5X. Effort M, Risk Med.
6. **Sequential YouTube/Instagram uploads** — marketing_posting.rs:435.
   Thread pool, 2-3 concurrent. 3-5X. Effort M, Risk Med.
7. **Blocking polling for MoneyPrinterTurbo** — marketing.rs:183. Async tokio.
   10-50X thread efficiency. Effort L, Risk High.
8. **Product proof screenshot per reel** — product-proof-capture.js:23. Cache
   by URL. 2-3X. Effort S, Risk Low.
9. **Sequential watcher rendering** — watcher.rs:93. Thread pool, 2-3
   concurrent. 2-3X. Effort M, Risk Med.
10. **Parallel caption overlays within scene** — render-pro.js:525. Promise.all.
    3-5X. Effort M, Risk Med.

### research-papers (8 findings)
1. **No vector index on 478k embeddings** — schema.sql. Full cosine scan.
   HNSW/IVF index → 50-100X. Effort S, Risk Low.
2. **No result caching on deterministic endpoints** — api.py. /tags/top-rated,
   /hot, /sleepers re-query every request. lru_cache + HTTP headers → 100-
   1000X repeat. Effort S, Risk Low.
3. **Subprocess per query embedding** — api.py:49. 100-500ms spawn overhead.
   In-process lazy model → 10-50X. Effort S, Risk Med.
4. **Semantic search JOIN order** — api.py:380. Overlays joined before
   citation filter. Push filter down → 10-50X. Effort M, Risk Med.
5. **Missing ClickHouse secondary indexes** — schema.sql. 5-20X filtered
   queries. Effort S, Risk Low.
6. **No pagination in API** — all endpoints. Add offset/limit. 10X UX. Effort
   M, Risk Low.
7. **Frontend tables no virtual scrolling** — data-table.tsx. 1000+ rows in
   DOM. 10-100X TTI. Effort M, Risk Low.
8. **Duplicate tag normalisation logic** — ch_exports.py, api.py. ClickHouse
   UDF. 5-10X maintainability. Effort S, Risk Low.

### rolepatch (8 findings)
1. **AI result caching for identical JD** — tailor/fit-score/cover-letter
   actions. Hash(resume_id + jd) → cached. 50-100X repeat tailors. Effort M,
   Risk Med.
2. **Streaming AI responses** — server actions. `generateText` → `streamText`.
   3-5X perceived. Effort M, Risk Med.
3. **Edge cache + ISR for static routes** — next.config, /tools/*. 10-50X
   repeat visitors. Effort S, Risk Low.
4. **Batch DB queries + indexes** — dashboard, fit-score. 2-5X. Effort S,
   Risk Low.
5. **Lazy-load heavy components** — dashboard, editor, tailor. CodeMirror/
   Monaco dynamic import. 2-3X FCP. Effort M, Risk Med.
6. **Memoise ATS score + evidence ranking** — tailor-flow.tsx:81. useMemo.
   5-10X. Effort S, Risk Low.
7. **Parallelise company scraping** — cover-letter-action.ts:98. Promise.all
   + timeout. 2-5X. Effort S, Risk Low.
8. **Defer non-critical DB writes** — tailor/fit-score actions. Background
   queue. 1-2X. Effort S, Risk Low.

### saas-maker (8 findings)
1. **N+1 feedback board (1 query per project)** — feedback.ts:102. Single
   JOIN → 10-50X. Effort M, Risk Low.
2. **Feedback board missing edge cache** — feedback.ts:102. Testimonials/
   roadmap already cached; board isn't. 10-100X. Effort S, Risk Low.
3. **has_changelog subquery per task row** — db.ts:1205. Denormalise boolean.
   5-20X. Effort M, Risk Med.
4. **Task list no pagination** — db.ts:1192. Returns all tasks. 5-20X. Effort
   M, Risk Low.
5. **Missing feedback_votes composite index** — schema. 2-5X. Effort S, Risk
   V.Low.
6. **SDK HTTP client no deduplication** — http.ts:47. In-memory cache + merge
   concurrent. 2-10X. Effort M, Risk Low.
7. **Feedback sort index missing** — schema. `(project_id, status, created_at
   DESC)`. 2-5X. Effort S, Risk V.Low.
8. **Cockpit feedback board no virtualisation** — feedback-board.tsx:150.
   100+ items, 3 columns. 3-10X. Effort M, Risk Med.

### significanthobbies (8 findings)
1. **N+1 like-count fetches on explore** — explore.tsx:43. 100 sequential
   COUNT queries → 1 GROUP BY. 50-100X. Effort S, Risk Low.
2. **N+1 comment user fetches** — timeline page.tsx:125. `inArray` → 10-50X.
   Effort S, Risk Low.
3. **Missing visibility index** — schema.ts:131. 10-50X discovery queries.
   Effort S, Risk Low.
4. **Hobby pages no ISR** — hobbies/[hobby]/page.tsx. 10-100X repeat. Effort
   S, Risk Low.
5. **Missing edge cache headers on API** — api/hobbies/route.ts. Add
   `s-maxage`. 10-100X. Effort S, Risk Low.
6. **Unoptimised comment avatars** — comments-section.tsx:44. Next.js Image.
   5-20X image load. Effort S, Risk Low.
7. **Hobby aggregation O(n×m×k)** — explore.tsx:78. Cache trending. 5-10X.
   Effort M, Risk Low-Med.
8. **Scroll reveal 30+ IntersectionObservers** — scroll-reveal.tsx:73. Shared
   observer. 3-5X. Effort M, Risk Low.

### starboard (9 findings)
1. **Sequential GitHub list repo fetching** — sync/route.ts:332. Parallel
   `Promise.all` → 5-10X. Effort S, Risk Low.
2. **Missing cache headers on API responses** — stars/discover routes. 10-50X
   repeat loads. Effort S, Risk V.Low.
3. **README concurrency too low (4)** — starboard-rag-documents.ts:23. → 16.
   3-4X. Effort S, Risk Low.
4. **VEC_TOP_K=500 oversized** — stars/route.ts:37. → 100. 2-3X. Effort S,
   Risk V.Low.
5. **No incremental list sync cursor** — sync/route.ts:332. Full refetch →
   `last_synced_at`. 10-50X. Effort M, Risk Low.
6. **Missing index on user_repos(user_id, is_starred)** — schema.sql:79.
   2-5X sync. Effort S, Risk V.Low.
7. **Blocking pagination loop in github-lists** — github-lists.ts:27. Parallel
   queue. 3-5X. Effort M, Risk Low.
8. **Unindexed facet queries** — stars/route.ts:159. Composite index. 2-3X.
   Effort S, Risk Low.
9. **Embedding cache miss on every sync** — sync/route.ts:165. In-memory LRU.
   5-10X. Effort M, Risk Low.

### swe-interview-prep (10 findings)
1. **N+1 bulk concept mastery updates** — concepts.mjs:85. 20 round-trips →
   batch. 10-20X. Effort S, Risk Low.
2. **N+1 bulk review mastery updates** — review-mastery.mjs:84. Same pattern.
   10-20X. Effort S, Risk Low.
3. **Missing indexes on user_progress/chats/notes** — schema.mjs. 5-10X.
   Effort S, Risk Negligible.
4. **Bulk Anki import sequential INSERTs** — imported-reviews-core.mjs:36.
   100 sequential → batch. 10-50X. Effort M, Risk Low.
5. **Large library JSON blocking LCP** — learning-os.ts. 430KB bundle.
   Dynamic import. 2-3X LCP. Effort M, Risk Med.
6. **Missing pagination on full-table scans** — multiple handlers. 3-5X.
   Effort M, Risk Low.
7. **Activity log index direction** — schema.mjs:88. Verify/ add ASC index.
   2-5X. Effort S, Risk Low.
8. **Concept rollup not memoised** — Learn.tsx:184. useMemo. 2-3X. Effort S,
   Risk Negligible.
9. **Sync debounce could batch more** — useProgress.ts:50. Batch dirty
   problems. 2-3X fewer calls. Effort M, Risk Low.
10. **(item 10 merged with #5)** — N/A.

### taste (10 findings)
1. **Missing FK indexes (12 tables)** — migrations/0000_init.sql. 10-50X
   admin/arena. Effort S, Risk None.
2. **Arena leaderboard loads ALL votes + battles** — arena.ts:130. DB filter
   → 10-100X. Effort S, Risk Low.
3. **R2 screenshots no cache headers** — taste-capture/index.ts:293.
   immutable 1yr → 10-100X repeat views. Effort S, Risk None.
4. **N+1 evaluator queries in pipeline** — pipeline.ts:76. Batch → 5-10X.
   Effort S, Risk Low.
5. **Sequential agent-run inserts** — visualEvaluation.ts:81. Batch insert →
   5-20X. Effort S, Risk Low.
6. **Repeated JSON parse in hot paths** — pipeline.ts:59,180,332. Parse once.
   3-5X. Effort S, Risk Low.
7. **React Query no staleTime/gcTime** — all pages. 2-3X fewer calls. Effort
   S, Risk Low.
8. **Sequential deletes in loop** — visualEvaluation.ts:71. Promise.all.
   2-4X. Effort S, Risk Low.
9. **Capture metrics multi-pass filter** — taste-capture/index.ts:205. Single
   pass. 2-3X. Effort S, Risk Low.
10. **Admin overview no pagination** — admin.ts:11. LIMIT at DB. 10-100X.
    Effort S, Risk None.

### tinygpt (8 findings)
1. **KV cache reuse across sessions** — Sample.swift, AgentLoop.swift.
   Persistent prefill cache. 20-50X multi-turn. Effort M, Risk Low.
2. **Unbatched inference in `tinygpt serve`** — EvalHarnessSupport.swift.
   Request queue + batching. 4-8X. Effort M, Risk Med.
3. **Browser model load caching** — worker.ts, backend.ts. IndexedDB weights
   + pipeline cache. 5-15X reload. Effort M, Risk Low.
4. **WebGPU pipeline compilation caching** — ops.ts. Serialise compiled
   pipelines. 3-10X reload. Effort M, Risk Med.
5. **Token streaming buffering** — AgentLoop.swift. 8-16 token batches. 2-4X.
   Effort S, Risk Low.
6. **Lazy model loading + async prefetch** — Sample.swift, HFLoad.swift.
   2-5X perceived. Effort M, Risk Med.
7. **Batched speculative decoding** — Sample.swift, SpeculativeDecode.swift.
   3-6X decode. Effort L, Risk Med.
8. **Eval harness request pipelining** — RunLmEval.swift. 3-8X throughput.
   Effort M, Risk Low.

### today-little-log (7 findings)
1. **Missing index on scoreboard_logs.user_id** — schema.ts:337. Full scan
   per user. 10-100X. Effort S, Risk V.Low.
2. **No PWA API response caching** — vite.config.ts:89. StaleWhileRevalidate
   for read-only endpoints. 50-100X offline/slow. Effort S, Risk Low.
3. **N+1 habit migration** — useHabits.ts:75. Sequential POSTs → batch. 10-
   50X. Effort S, Risk Low.
4. **Unbounded scoreboard-logs fetch** — useScoreboard.ts:182. No `until`
   param. 20-100X for 6+ months. Effort M, Risk Low.
5. **Repeated item lookups in useScoreboard** — useScoreboard.ts:213. Map +
   useMemo. 5-20X. Effort S, Risk Low.
6. **Unoptimised localStorage serialisation** — useScoreboard.ts:58. Debounce
   writes. 10-50X rapid logging. Effort M, Risk Low.
7. **Missing indexes on daily-checkins/journal** — [resource].ts:236. 5-50X.
   Effort M, Risk Low.

### truehire (9 findings)
1. **N+1 recent profiles (30 score queries)** — recent/page.tsx:18. Batch
   `DISTINCT ON (user_id)` → 15X. Effort M, Risk Low.
2. **getPublicWorkHistory loads ALL verifications** — score-service.ts:72.
   `inArray` filter → 100X at scale. Effort S, Risk V.Low.
3. **Missing FK indexes (contributions, activity, workHistory)** — schema.ts.
   5-50X. Effort S, Risk V.Low.
4. **No edge cache on profile pages** — [handle]/page.tsx. `s-maxage=300` →
   10-100X repeat. Effort S, Risk V.Low.
5. **Sequential GitHub craft signal calls (100/repo)** — github.ts:397.
   GraphQL batch → 3-5X. Effort M, Risk Med.
6. **N+1 shortlist candidate loading** — shortlist/page.tsx:199. 16 queries →
   2. 8-16X. Effort M, Risk Low.
7. **Year-by-year GraphQL queries** — github.ts:228. 6 queries → 1 cursor-
   based. 6X. Effort M, Risk Med.
8. **No request-level caching between renders** — [handle]/page.tsx:31.
   React `cache()`. 2X. Effort S, Risk V.Low.
9. **Unbounded JSON parsing per render** — [handle]/page.tsx:84. Memoise /
   store parsed. 5-10X. Effort S-M, Risk Low.

### verified-bases (9 findings)
1. **Missing cache headers on static assets** — astro.config.mjs. `_headers`
   file. 10-100X repeat visits. Effort S, Risk Low.
2. **DB connection per request** — store.go:18. `sql.Open` per handler →
   singleton. 5-15% latency. Effort S, Risk Low.
3. **Blocking WaitGroup on email sends** — webhook.go:119, submit.go:64.
   Fire-and-forget. 2-5X. Effort S, Risk Low.
4. **HTTP client per request** — resend.go, dodo.go, turnstile.go. Package-
   level singletons. 10-30% API calls. Effort S, Risk Low.
5. **Missing DB indexes (intent_id)** — migrations/0001. 10-50X lookups.
   Effort S, Risk V.Low.
6. **Rate limit KV reads every request** — middleware.go:51. Local in-memory
   + KV fallback. 20-50% latency. Effort M, Risk Med.
7. **Render-blocking CSS + animations** — global.css:34. Async load, lazy
   animations. 10-30% LCP. Effort M, Risk Low.
8. **N+1 prevention (document pattern)** — webhook.go:88. Preventative.
   Effort S, Risk Low.
9. **Content-Length header on downloads** — delivery.go:107. Verify always
   set. 1-5% UX. Effort S, Risk V.Low.

---

## Top 60 Fleet-Wide Quick Wins (S effort, high magnitude, low risk)

Ranked by magnitude × breadth. These are the "do this first" items.

| # | Project | Item | Magnitude | Effort |
|---|---------|------|-----------|--------|
| 1 | research-papers | lru_cache on deterministic endpoints | 100-1000X | S |
| 2 | research-papers | Vector index on 478k embeddings | 50-100X | S |
| 3 | significanthobbies | N+1 like-counts → 1 GROUP BY | 50-100X | S |
| 4 | anime-list | (season, year) composite index | 50-100X | S |
| 5 | truehire | `inArray` filter on verifications | 100X | S |
| 6 | looptv | `_headers` for catalog.json | 10-100X | S |
| 7 | open-historia | Cache headers on 2-5MB map assets | 10-100X | S |
| 8 | today-little-log | Index on scoreboard_logs.user_id | 10-100X | S |
| 9 | today-little-log | PWA StaleWhileRevalidate for API | 50-100X | S |
| 10 | taste | R2 screenshots immutable cache headers | 10-100X | S |
| 11 | taste | Arena leaderboard DB filter (not all votes) | 10-100X | S |
| 12 | taste | 12 missing FK indexes (one migration) | 10-50X | S |
| 13 | everythingrated | SQL `inArray` instead of full ratings scan | 10-50X | S |
| 14 | anime-list | N+1 collections → Map lookup | 10-50X | S |
| 15 | free-ai | Module-level model registry cache | 100X parses | S |
| 16 | forecast-lab | HashSet for bucket dedup | 10-100X | S |
| 17 | forecast-lab | HashMap for bucket location lookup | 10-100X | S |
| 18 | materia | Reverse index for condition pages | 50-100X | S |
| 19 | materia | Reverse index for study cited-by | 10-50X | S |
| 20 | high-signal | KV-cache facet aggregates | 10-50X | S |
| 21 | starboard | Cache headers on API routes | 10-50X | S |
| 22 | saas-maker | Edge cache on feedback board | 10-100X | S |
| 23 | pace | Cursor settle 350ms → signal | 10-50X | S |
| 24 | drank | Batched concurrent domain refresh | 10-50X | S |
| 25 | truehire | Edge cache on profile pages | 10-100X | S |
| 26 | significanthobbies | Hobby pages ISR | 10-100X | S |
| 27 | significanthobbies | Edge cache headers on API | 10-100X | S |
| 28 | verified-bases | `_headers` for static assets | 10-100X | S |
| 29 | verified-bases | DB connection singleton | 5-15% | S |
| 30 | verified-bases | Missing DB indexes (intent_id) | 10-50X | S |
| 31 | verified-bases | Async email sends (fire-and-forget) | 2-5X | S |
| 32 | verified-bases | HTTP client reuse (package-level) | 10-30% | S |
| 33 | rolepatch | Edge cache + ISR for static routes | 10-50X | S |
| 34 | swe-interview-prep | Batch N+1 concept mastery updates | 10-20X | S |
| 35 | swe-interview-prep | Batch N+1 review mastery updates | 10-20X | S |
| 36 | swe-interview-prep | Missing indexes (progress/chats/notes) | 5-10X | S |
| 37 | ai-game | N+1 NPC lookups → Map | 10-100X | S |
| 38 | ai-game | Batch embeddings in dialogue | 10-40X | S |
| 39 | ai-game | Worldgen cache key → hash | 10-20X | S |
| 40 | forecast-lab | HashSet for property value lookup | 10-50X | S |
| 41 | forecast-lab | Pass fitted model to attach_forecast_quality | 2-5X | S |
| 42 | forecast-lab | Borrow events in fit_model (no clone) | 2-10X | S |
| 43 | free-ai | Health snapshot cache per request | 2-10X | S |
| 44 | free-ai | Quota cache TTL + background refresh | 80-90% fewer calls | S |
| 45 | free-ai | Parallel provider candidate fetching | 3-5X | S |
| 46 | high-signal | Batch perception/improvements queries | 3-5X | S |
| 47 | high-signal | DB-level ranking for stocks | 2-3X | S |
| 48 | karte | Missing FK indexes | 5-20X | S |
| 49 | karte | OG image cache 5min → 1hr | 20-50% CPU | S |
| 50 | knowledge-base | Use Vectorize metadata (skip D1 hydration) | 2-5X | S |
| 51 | knowledge-base | Graph entity targeted ID query | 5-10X | S |
| 52 | looptv | Memoize catalog flattening | 5-10X | S |
| 53 | looptv | Simplify next-preview deps | 3-5X | S |
| 54 | materia | Reverse index for compound/study | 30-50X | S |
| 55 | materia | Batch compound resolution in checker | 5-10X | S |
| 56 | open-historia | Province lookups → Map | 10-50X | S |
| 57 | open-historia | Relation filtering → Map | 2-5X | S |
| 58 | open-historia | Geopolitical context memoise | 1.5-3X | S |
| 59 | pace | Permission polling 1.5s → 30s | 10-20X | S |
| 60 | pace | LM Studio polling 5s → failure-driven | 6-12X | S |

---

## Notes on Confidence

All findings above are grounded in code the agents actually read (file:line
cited). A few warrant a quick re-check before implementation because the
magnitude depends on data scale that may not yet exist:

- **research-papers #1 (vector index):** 478k rows — full scan is "acceptable"
  per project docs today, but HNSW is a one-line index add. Verify ClickHouse
  version supports `vector_similarity`.
- **everythingrated #1:** magnitude assumes 1000+ ratings; verify current row
  count before claiming 50X.
- **taste #1 (12 indexes):** verify each table's row count; indexes on tiny
  tables don't help.
- **truehire #2 (verifications full scan):** verify the table isn't already
  small enough that the scan is cheap.
- **drank #8:** agent self-flagged as false positive (leaderboard already
  memoised) — excluded from this report.

Items not listed in the top-60 but still high-ROI are in the per-project
sections above — the M-effort items (streaming AI, FTS5, virtualisation, KV
cache reuse, tokio migration) are the next tier once the quick wins land.

## Follow-up

Per AGENTS.md, durable next steps for product-affecting work should mirror into
SaaS Maker tasks. The cross-fleet patterns (P1-P10) are candidates for fleet
standards work — reusable lint rules, shared cache helpers, a `<VirtualList>`
primitive, a `_headers` template — rather than 28 one-off fixes.
