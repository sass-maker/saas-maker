# Fleet Performance + UI Master List — ROI × Risk Sorted with Devil's Advocate

Every finding from all 28 projects, sorted by ROI (magnitude × confidence ×
1/risk × 1/effort). Each item includes a **devil's advocate** note challenging
the recommendation. UI improvements are integrated throughout.

Verification status: items marked **VERIFIED** were spot-checked against real
code. Items marked **PENDING** are awaiting verification. Items marked
**ADJUSTED** had their magnitude revised after verification.

---

## Tier S — Do First (100X+ or near-zero effort with 10X+)

### S1. research-papers: lru_cache on deterministic endpoints
- **Magnitude:** 100-1000X repeat requests · **Effort:** S · **Risk:** Low
- **What:** /tags/top-rated, /hot, /sleepers re-query ClickHouse every request.
  Add `@lru_cache` + HTTP `Cache-Control: public, max-age=3600`.
- **Devil's advocate:** Are these endpoints truly deterministic? If overlay
  tables update via `warm-update`, cached results go stale. Need cache
  invalidation hook on warm-update, not just TTL. Also: if traffic is low
  (research tool), the cache hit rate may be near zero — 1000X of nothing is
  nothing. **Counter:** Even at low traffic, the first load benefits. And
  invalidation is a 5-line hook. Worth it.
- **Verification:** PENDING

### S2. research-papers: vector index on 478k embeddings
- **Magnitude:** 50-100X semantic search · **Effort:** S · **Risk:** Low
- **What:** Full cosine distance scan on 478k rows. Add HNSW/IVF vector
  similarity index.
- **Devil's advocate:** ClickHouse vector_similarity index is relatively new.
  Verify the deployed ClickHouse version supports it. Also: HNSW uses
  significant memory (~2x the embedding storage). On a 16GB host with 478k
  × 384-dim float32 = ~700MB embeddings, the index adds ~1.4GB. May be fine,
  but check. Also: approximate NN may return slightly different results than
  exact scan — verify recall is acceptable. **Counter:** Even IVF (lighter
  than HNSW) would be 10-50X. And 478k is only going to grow.
- **Verification:** PENDING

### S3. truehire: getPublicWorkHistory loads ALL verifications
- **Magnitude:** 100X at scale · **Effort:** S · **Risk:** V.Low
- **What:** `db.select().from(employerVerifications)` with no WHERE, then
  filters in JS. Add `inArray(workHistoryId, history.map(h => h.id))`.
- **Devil's advocate:** If the table has 50 rows today, this "100X" is
  100X of 2ms = still 2ms. The fix is correct but the magnitude is
  theoretical. **Counter:** The fix is a one-liner with zero risk. Do it
  regardless — it's about scaling correctly, not current pain.
- **Verification:** PENDING

### S4. free-ai: module-level model registry cache
- **Magnitude:** 100X fewer JSON parses · **Effort:** S · **Risk:** V.Low
- **What:** `getModelRegistry()` parses `MODEL_REGISTRY_JSON` every request.
  Cache at module level.
- **Devil's advocate:** JSON.parse of a 30-model registry is ~0.1ms. 100X
  of 0.1ms = 10ms saved per request. Is this actually meaningful? **Counter:**
  At 1000 req/s, that's 10s of CPU time/s wasted on parsing. On Workers
  with 10ms CPU limit, this could be the difference between fitting in
  budget and not. Also: it's 3 lines of code. Just do it.
- **Verification:** PENDING

### S5. significanthobbies: N+1 like-counts → 1 GROUP BY
- **Magnitude:** 50-100X explore page · **Effort:** S · **Risk:** Low
- **What:** 100 sequential `COUNT(*)` queries → 1 `GROUP BY` query.
- **Devil's advocate:** Does the explore page actually fetch 100 timelines?
  If it's 20, that's 20 queries → 1, which is 20X not 100X. Still good but
  not as dramatic. **Counter:** Even 20X on a page that's the marketing
  surface is worth a 5-line fix.
- **Verification:** PENDING

### S6. anime-list: (season, year) composite index
- **Magnitude:** 50-100X discover queue · **Effort:** S · **Risk:** V.Low
- **What:** No composite index on (season, year). Discover queue full-scans
  14.8k rows.
- **Devil's advocate:** 14.8k rows is tiny. SQLite scans 14.8k rows in <1ms.
  The "50-100X" is 50-100X of <1ms. **Counter:** True today, but the table
  will grow. And the index is one line with zero risk. The real question is
  whether the discover queue does additional JS filtering that's the actual
  bottleneck. Check the full query path.
- **Verification:** PENDING

### S7. today-little-log: index on scoreboard_logs.user_id
- **Magnitude:** 10-100X · **Effort:** S · **Risk:** V.Low
- **What:** No index on user_id for scoreboard_logs. Every GET does a full
  scan.
- **Devil's advocate:** How many rows in scoreboard_logs? If users have 30
  days × 12 items = 360 rows, a full scan is trivial. **Counter:** The table
  is user-scoped but not partitioned. As users accumulate, it grows
  unboundedly. Index is one line. Do it.
- **Verification:** PENDING

### S8. taste: R2 screenshots immutable cache headers
- **Magnitude:** 10-100X repeat views · **Effort:** S · **Risk:** None
- **What:** Screenshots uploaded to R2 without `Cache-Control`. Add
  `public, max-age=31536000, immutable`.
- **Devil's advocate:** Screenshots are immutable? What if a user re-captures
  a variant? **Counter:** The R2 key includes variant ID + timestamp, so
  re-captures get new keys. Old keys are genuinely immutable. Safe.
- **Verification:** PENDING

### S9. looptv: _headers for catalog.json
- **Magnitude:** 10-100X repeat visits · **Effort:** S · **Risk:** V.Low
- **What:** 500KB-1MB catalog.json re-fetched every load. Add `_headers` with
  `Cache-Control: public, max-age=604800`.
- **Devil's advocate:** If the catalog updates mid-week, users won't see new
  videos for up to 7 days. **Counter:** Use `stale-while-revalidate` instead
  of hard max-age. Or shorter TTL (1 hour) with SWR. The catalog is also
  versioned by CI, so a cache-busting query param could be added.
- **Verification:** PENDING

### S10. verified-bases: _headers for static assets
- **Magnitude:** 10-100X repeat visits · **Effort:** S · **Risk:** Low
- **What:** No cache headers on any static asset. Add `_headers` file.
- **Devil's advocate:** Astro already inlines CSS (`inlineStylesheets:
  'always'`). The main asset is HTML pages, which shouldn't be cached
  aggressively. **Counter:** JS chunks and images should be cached
  immutably (content-hashed filenames). HTML can be `no-cache` or short
  TTL. The `_headers` file can differentiate.
- **Verification:** PENDING

---

## Tier A — Do Next (10-50X+, S effort, Low risk)

### A1. everythingrated: SQL inArray instead of full ratings scan
- **Magnitude:** 10-50X · **Effort:** S · **Risk:** Low
- **Devil's advocate:** How many ratings exist today? If 100, the full scan
  is <1ms. The fix is correct but the magnitude is theoretical until scale.
  **Counter:** The fix is a straightforward Drizzle query change. Do it for
  correctness, not just current perf.
- **Verification:** PENDING

### A2. anime-list: N+1 collections → Map lookup
- **Magnitude:** 10-50X · **Effort:** S · **Risk:** V.Low
- **Devil's advocate:** Collections with 50 items are rare. Most have 5-10.
  **Counter:** Even 10 sequential queries → 1 Map lookup is 10X. And the
  code is simpler with a Map.
- **Verification:** PENDING

### A3. forecast-lab: HashSet for bucket dedup
- **Magnitude:** 10-100X · **Effort:** S · **Risk:** Low
- **Devil's advocate:** How many buckets? If 20, Vec::contains is fine.
  **Counter:** The code also does this for property value lookup (lib.rs:452)
  which can have 10k+ keys. HashSet is the right data structure regardless.
- **Verification:** PENDING

### A4. materia: reverse index for condition/study/compound pages
- **Magnitude:** 50-100X build time · **Effort:** S · **Risk:** Low
- **Devil's advocate:** This is build-time perf, not user-facing. Does build
  time actually matter? **Counter:** Faster builds = faster iteration = more
  content updates. And the reverse index is also usable at runtime if you
  ever add dynamic pages. Also: 207 remedies × 77 conditions × 60 compounds
  = significant build time today.
- **Verification:** PENDING

### A5. high-signal: KV-cache facet aggregates
- **Magnitude:** 10-50X · **Effort:** S · **Risk:** Low
- **Devil's advocate:** Facets change when new signals are published. If
  publishing is daily, a 1-hour cache means facets are up to 1 hour stale.
  **Counter:** Facets are approximate by nature (top tags, categories).
  1-hour staleness is invisible to users.
- **Verification:** PENDING

### A6. starboard: cache headers on API routes
- **Magnitude:** 10-50X · **Effort:** S · **Risk:** V.Low
- **Devil's advocate:** Star data changes when user stars/unstars repos.
  Cached responses could show stale state. **Counter:** Use short TTL (60s)
  + `stale-while-revalidate`. Or only cache read-only discovery endpoints,
  not the user's personal star list.
- **Verification:** PENDING

### A7. saas-maker: edge cache on feedback board
- **Magnitude:** 10-100X · **Effort:** S · **Risk:** Low
- **Devil's advocate:** Feedback board is user-scoped. Caching it means one
  user could see another's feedback if cache keys aren't scoped correctly.
  **Counter:** Use user-scoped cache key (already done for testimonials).
  The pattern exists in the codebase — just copy it.
- **Verification:** PENDING

### A8. pace: cursor settle 350ms → signal
- **Magnitude:** 10-50X latency · **Effort:** S · **Risk:** Low
- **Devil's advocate:** The 350ms is there for a reason — the cursor
  animation needs to finish visually. Removing it could make the click feel
  disconnected from the animation. **Counter:** The fix is signal-based
  completion, not removing the wait entirely. The cursor overlay emits a
  completion event; you wait for that instead of a hardcoded sleep. If the
  signal doesn't arrive, fall back to a shorter timeout (150ms).
- **Verification:** PENDING

### A9. drank: batched concurrent domain refresh
- **Magnitude:** 10-50X for 50 domains · **Effort:** S · **Risk:** Low
- **Devil's advocate:** Ahrefs free API may rate-limit concurrent requests.
  The 750ms delay might be there for rate compliance, not just politeness.
  **Counter:** Check Ahrefs API docs for rate limits. If they allow 2-3
  concurrent, batch size 2-3 is safe. If strictly 1 at a time, this won't
  help — but the delay could still be reduced.
- **Verification:** PENDING

### A10. truehire: edge cache on profile pages
- **Magnitude:** 10-100X repeat · **Effort:** S · **Risk:** V.Low
- **Devil's advocate:** Profile pages show real-time score data. If a user's
  score updates, cached page shows stale score. **Counter:** 5-minute ISR
  (already set as `revalidate = 300`) is fine. The issue is no
  `Cache-Control` header for edge caching. Add `s-maxage=300,
  stale-while-revalidate=900`.
- **Verification:** PENDING

### A11. significanthobbies: hobby pages ISR
- **Magnitude:** 10-100X repeat · **Effort:** S · **Risk:** Low
- **Devil's advocate:** Hobby pages show public timelines which update
  frequently. ISR could show stale content. **Counter:** 1-hour ISR is fine
  for hobby description pages. The timelines within can be fetched
  client-side with fresh data.
- **Verification:** PENDING

### A12. rolepatch: edge cache + ISR for static routes
- **Magnitude:** 10-50X repeat · **Effort:** S · **Risk:** Low
- **Devil's advocate:** /tools/* pages may have dynamic content (pricing,
  availability). **Counter:** /blog/[slug] is truly static. /tools/* can
  use ISR with 1-hour revalidation. Pricing page can be excluded.
- **Verification:** PENDING

### A13. swe-interview-prep: batch N+1 concept/review mastery
- **Magnitude:** 10-20X · **Effort:** S · **Risk:** Low
- **Devil's advocate:** Bulk updates are triggered by auto-tagging (5min
  idle). Is this a hot path? If it runs once per 5 minutes, 10-20X of
  infrequent = still infrequent. **Counter:** The user experiences it as a
  UI freeze. 2-3s → 200ms is noticeable. Do it.
- **Verification:** PENDING

### A14. ai-game: N+1 NPC lookups → Map
- **Magnitude:** 10-100X · **Effort:** S · **Risk:** Low
- **Devil's advocate:** How many NPCs? If 10, O(n²) is 100 ops — trivial.
  **Counter:** The agent reported 20-50 NPCs. 50² = 2500 per tick, every 4
  seconds. Map is trivially correct.
- **Verification:** PENDING

### A15. ai-game: batch embeddings in dialogue
- **Magnitude:** 10-40X · **Effort:** S · **Risk:** Low
- **Devil's advocate:** Are embeddings really called 40 times per dialogue
  turn? That seems extreme. **Counter:** The agent cited sim.ts:1089 with
  40 recent memories embedded sequentially. If semantic recall is enabled,
  this is real. If disabled by default, it's a latent issue.
- **Verification:** PENDING

### A16. taste: 12 missing FK indexes
- **Magnitude:** 10-50X · **Effort:** S · **Risk:** None
- **Devil's advocate:** How many rows in these tables? If studies has 10
  rows, indexes don't help. **Counter:** Indexes are free (SQLite/D1
  indexes are cheap). Add them for future scaling. The arena leaderboard
  query (loading ALL votes) is the real issue, not just indexes.
- **Verification:** PENDING

### A17. taste: arena leaderboard DB filter
- **Magnitude:** 10-100X · **Effort:** S · **Risk:** Low
- **Devil's advocate:** How many votes total? If 100, loading all is fine.
  **Counter:** The query loads ALL votes AND ALL battles into memory. Even
  at 1000 votes, that's wasteful. The fix (filter at DB) is correct
  regardless of scale.
- **Verification:** PENDING

### A18. open-historia: cache headers on map assets
- **Magnitude:** 10-100X repeat · **Effort:** S · **Risk:** Low
- **Devil's advocate:** Map assets (provinces-combined.json) may change
  with game updates. **Counter:** Content-hash the filename or use
  versioned paths. The current data is static.
- **Verification:** PENDING

### A19. open-historia: province lookups → Map
- **Magnitude:** 10-50X map render · **Effort:** S · **Risk:** Low
- **Devil's advocate:** 5000 provinces is a lot, but is the .find() really
  in a hot loop? **Counter:** It's in buildRelationBorderGeoJSON which runs
  on every relation change. With 5000 provinces × 5-10 neighbors each, that's
  25k-50k .find() calls. Map is obviously correct.
- **Verification:** PENDING

### A20. free-ai: health snapshot cache per request
- **Magnitude:** 2-10X · **Effort:** S · **Risk:** Low
- **Devil's advocate:** Health state changes when providers go down. Caching
  it means routing decisions use stale health. **Counter:** 5-10s TTL is
  fine for routing. A provider going down and back up within 10s is rare.
- **Verification:** PENDING

---

## Tier B — UI Improvements (interface is the moat)

### B1. rolepatch: streaming AI responses
- **Magnitude:** 3-5X perceived · **Effort:** M · **Risk:** Med
- **What:** `generateText` → `streamText`. Show partial results as they
  arrive.
- **Devil's advocate:** Streaming adds complexity in error handling. If the
  stream breaks mid-way, the UI is in a partial state. **Counter:** Vercel
  AI SDK handles this with `onError` callbacks. The UX win (seeing content
  in 1s vs 15s) is worth the complexity.
- **UI impact:** Transforms "spinner for 15s" into "text appears in 1s"

### B2. codevetter: streaming LLM findings
- **Magnitude:** 30-50X time-to-first-finding · **Effort:** M · **Risk:** Low
- **What:** Stream JSON findings as they arrive via Tauri events.
- **Devil's advocate:** Streaming JSON parsing is fragile — partial JSON
  is invalid. **Counter:** Use a streaming JSON parser (e.g., json-stream)
  or emit findings as newline-delimited JSON. Each finding is a complete
  JSON object on its own line.
- **UI impact:** User sees first critical issue in 0.3s instead of 8s

### B3. high-signal: edge cache for instant brief load
- **Magnitude:** 10-50X · **Effort:** M · **Risk:** Low
- **What:** Add `s-maxage=300, stale-while-revalidate=600` to /brief/daily.
- **Devil's advocate:** Personalised sections (perception, improvements)
  can't be cached. **Counter:** Cache only the public sections (stocks,
  ideas, trends). Personal sections are fetched separately.
- **UI impact:** Brief loads in <100ms instead of 500-2000ms

### B4. karte: ChatWidget code-split + streaming
- **Magnitude:** 15-25% FCP · **Effort:** M · **Risk:** Low
- **What:** Split ChatWidget into smaller chunks. Stream chat responses.
- **Devil's advocate:** ChatWidget is the core feature — lazy-loading it
  delays the main interaction. **Counter:** Load the chat button eagerly
  (small), lazy-load the chat window (large) on click.
- **UI impact:** Profile page loads faster, chat opens on demand

### B5. significanthobbies: Next.js Image for avatars
- **Magnitude:** 5-20X image load · **Effort:** S · **Risk:** Low
- **What:** Raw `<img>` → `<Image>` for comment avatars.
- **Devil's advocate:** Google OAuth images may not allow Next.js Image
  optimization (remote domains config). **Counter:** Add the domain to
  `next.config.js` `images.remotePatterns`. Or use `unoptimized` prop —
  still gets lazy loading + async decoding.
- **UI impact:** Avatars load instantly, no layout shift

### B6. looptv: preload next video
- **Magnitude:** 1-2X Next button · **Effort:** S · **Risk:** Low
- **What:** Use `cueVideoById` for next video while current plays.
- **Devil's advocate:** Preloading uses bandwidth the user may not want
  spent. **Counter:** YouTube IFrame `cueVideoById` loads metadata only,
  not the full video. Minimal bandwidth.
- **UI impact:** "Next" button feels instant

### B7. saas-maker: virtualise feedback board
- **Magnitude:** 3-10X render · **Effort:** M · **Risk:** Med
- **What:** 100+ feedback items in 3 columns, no virtualisation.
- **Devil's advocate:** Virtualisation breaks drag-and-drop between columns.
  **Counter:** Use `@tanstack/react-virtual` which supports drag-and-drop.
  Or only virtualise within each column, not across.
- **UI impact:** Smooth scrolling through 100+ items

### B8. reader: FTS5 search
- **Magnitude:** 10-100X search · **Effort:** M · **Risk:** Med
- **What:** In-memory regex search → SQLite FTS5.
- **Devil's advocate:** FTS5 requires schema migration and index rebuild.
  Existing search may have custom ranking that FTS5 doesn't replicate.
  **Counter:** FTS5 supports custom ranking functions via `bm25()`. The
  migration is a one-time cost. Search is the core feature — it must be
  fast.
- **UI impact:** Search results appear as you type

### B9. email-manager: virtualise email list
- **Magnitude:** 5-10X scroll · **Effort:** M · **Risk:** Low
- **What:** 500+ emails rendered as full DOM.
- **Devil's advocate:** Virtualisation breaks keyboard navigation (Ctrl+A,
  shift-click range select). **Counter:** `react-window` supports
  keyboard nav with `useDynamicWidth`. Test thoroughly.
- **UI impact:** Smooth scroll through 1000+ emails

### B10. drank: React.memo domain cards
- **Magnitude:** 3-10X re-render · **Effort:** M · **Risk:** Low
- **What:** 45 cards re-render on any state change.
- **Devil's advocate:** React.memo with wrong props comparison can cause
  stale renders. **Counter:** Use a custom comparison function that checks
  domain data + updating state only.
- **UI impact:** No jank when one domain updates

### B11. rolepatch: lazy-load CodeMirror/Monaco
- **Magnitude:** 2-3X FCP · **Effort:** M · **Risk:** Med
- **What:** Heavy editor components loaded eagerly.
- **Devil's advocate:** Lazy-loading the editor means a loading state on
  the editor page — the core page. **Counter:** Show a skeleton editor
  frame while loading. The user expects a brief load for a code editor.
- **UI impact:** Dashboard loads fast, editor loads on demand

### B12. swe-interview-prep: lazy-load library content
- **Magnitude:** 2-3X LCP · **Effort:** M · **Risk:** Med
- **What:** 430KB of library JSON in the main bundle.
- **Devil's advocate:** Dynamic import means the library content isn't
  available on first render — the learn page looks empty. **Counter:**
  Load the current module's content eagerly, lazy-load the rest. Or show
  a skeleton while loading.
- **UI impact:** First paint is 2-3X faster

### B13. open-historia: map rendering optimisation
- **Magnitude:** 10-50X map render · **Effort:** M · **Risk:** Med
- **What:** O(n²) province lookups + GeoJSON rebuild on every relation
  change.
- **Devil's advocate:** Map rendering optimisation is complex and could
  introduce visual bugs. **Counter:** The Map lookup fix (S-tier) is
  trivial and safe. The GeoJSON rebuild fix (separate war tracking) is
  the risky one — do the Map fix first.
- **UI impact:** Map updates smoothly on turn resolution

### B14. pace: replace hardcoded sleeps with signals
- **Magnitude:** 10-50X perceived latency · **Effort:** M · **Risk:** Low
- **What:** 350ms cursor settle + 600ms post-action delay → event-driven.
- **Devil's advocate:** Removing the 600ms screenshot delay could capture
  pre-action state if the UI hasn't settled. **Counter:** Use visual diff
  polling (already exists: PaceScreenImageDiffer). Poll every 50-100ms,
  proceed when screen changes. Cap at 600ms as fallback.
- **UI impact:** Agent feels instant instead of sluggish

### B15. all projects: loading skeletons
- **Magnitude:** Perceived 2-3X · **Effort:** S per project · **Risk:** Low
- **What:** Replace blank screens / spinners with skeleton loaders.
- **Devil's advocate:** Skeletons add code for a transient state. **Counter:**
  Skeletons make the app feel fast even when it isn't. They're the
  single highest-ROI UI improvement for perceived performance.
- **UI impact:** Every page feels responsive immediately

### B16. all projects: empty states
- **Magnitude:** Retention · **Effort:** S per project · **Risk:** Low
- **What:** Lists with no items show "No items yet" with a CTA instead of
  blank space.
- **Devil's advocate:** Writing good empty states takes design effort.
  **Counter:** A simple message + icon + CTA is 10 lines of JSX. It's the
  difference between "is this broken?" and "I should add something."
- **UI impact:** Users know what to do next

### B17. all projects: error states with retry
- **Magnitude:** Trust · **Effort:** S per project · **Risk:** Low
- **What:** API failures show "Something went wrong" + retry button instead
  of blank screens or console errors.
- **Devil's advocate:** Error boundaries already exist in React. **Counter:**
  Most projects catch errors silently or show nothing. An explicit error
  state with retry builds trust.
- **UI impact:** Users trust the app when things go wrong

---

## Tier C — Medium Effort, High Impact (M effort)

### C1. free-ai: embedding request caching (KV)
- **Magnitude:** 50-100X cache hit · **Effort:** M · **Risk:** Low
- **Devil's advocate:** Embedding cache invalidation: if the model changes,
  cached embeddings are wrong. **Counter:** Include model name in cache key.
  Different model = different key = no stale hits.
- **Verification:** PENDING

### C2. free-ai: analytics batch writes to D1
- **Magnitude:** 50-100X fewer transactions · **Effort:** M · **Risk:** Low
- **Devil's advocate:** Batch buffer must survive Worker restarts or
  analytics are lost. **Counter:** Use `waitUntil` with a flush-on-idle
  pattern. Or accept minor analytics loss on restart — analytics are
  not critical data.
- **Verification:** PENDING

### C3. knowledge-base: lexical chunk full-scan → D1 LIKE
- **Magnitude:** 10-50X · **Effort:** M · **Risk:** Low
- **Devil's advocate:** `searchLexicalChunks` already exists but may not
  replicate the exact BM25 scoring. **Counter:** Use D1 for prefiltering
  (get candidate chunks), then score the smaller set in JS. Best of both.
- **Verification:** PENDING

### C4. email-manager: incremental sync
- **Magnitude:** 10-100X repeat sync · **Effort:** M · **Risk:** Low
- **Devil's advocate:** Gmail's `after:` query has edge cases (timezone,
  delayed delivery). **Counter:** Use `after:` + store last message ID as
  checkpoint. Fall back to full sync if checkpoint is missing.
- **Verification:** PENDING

### C5. research-papers: in-process embedding (no subprocess)
- **Magnitude:** 10-50X · **Effort:** S · **Risk:** Med
- **Devil's advocate:** In-process model loading adds ~400MB RAM. On a
  shared host, this may be a problem. **Counter:** Use lazy loading —
  model loads on first semantic search, stays resident. 400MB is
  acceptable on a 16GB host.
- **Verification:** PENDING

### C6. tinygpt: KV cache reuse across sessions
- **Magnitude:** 20-50X multi-turn · **Effort:** M · **Risk:** Low
- **Devil's advocate:** KV cache serialisation is large (MBs per session).
  Storing it in memory limits concurrent sessions. **Counter:** LRU
  eviction with a max of 3-5 cached sessions. Most users use one model.
- **Verification:** PENDING

### C7. reel-pipeline: CDP session pool for Chrome
- **Magnitude:** 5-10X caption rendering · **Effort:** M · **Risk:** Low
- **Devil's advocate:** CDP session management is complex; Chrome may leak
  memory over long sessions. **Counter:** Recycle the Chrome instance
  every 100 screenshots. CDP is already used in the codebase.
- **Verification:** PENDING

### C8. reel-pipeline: GPU-accelerated FFmpeg
- **Magnitude:** 3-10X encoding · **Effort:** M · **Risk:** Med
- **Devil's advocate:** GPU codecs (hevc_videotoolbox, hevc_nvenc) produce
  larger files at same quality. **Counter:** Use for intermediate renders
  (speed matters), re-encode final output with libx264 for quality.
- **Verification:** PENDING

---

## Tier D — Higher Risk / Effort, Do Last

### D1. everythingrated: N+1 in topItemsByAspectKey → SQL JOIN
- **Magnitude:** 20-100X · **Effort:** M · **Risk:** Med
- **Devil's advocate:** SQL aggregation must match JS logic exactly.
  Off-by-one in GROUP BY could produce wrong leaderboards. **Counter:**
  Write a test comparing JS and SQL results on the same dataset.

### D2. karte: rate limiter → Durable Objects
- **Magnitude:** 10-100X abuse protection · **Effort:** M · **Risk:** Med
- **Devil's advocate:** DOs add cost (per-request billing) and complexity.
  **Counter:** Only needed if abuse is a real problem. For a link-in-bio
  tool with low traffic, the in-memory limiter may be fine. Do this only
  if you see abuse.

### D3. reel-pipeline: async tokio migration
- **Magnitude:** 10-50X thread efficiency · **Effort:** L · **Risk:** High
- **Devil's advocate:** Full tokio migration is a rewrite. ureq is blocking;
  switching to reqwest changes the entire HTTP layer. **Counter:** Don't
  do this now. Use a thread pool (rayon) for parallelism instead — much
  smaller change.

### D4. knowledge-base: query stream doesn't stream retrieval
- **Magnitude:** 2-3X perceived · **Effort:** L · **Risk:** Med
- **Devil's advocate:** Refactoring runKbAnswer to be async-iterable is a
  significant change. **Counter:** Send retrieval results as a separate
  SSE event before synthesis starts. User sees sources immediately.

### D5. tinygpt: batched speculative decoding
- **Magnitude:** 3-6X decode · **Effort:** L · **Risk:** Med
- **Devil's advocate:** Requires a draft model and batched KV cache
  management — research-level complexity. **Counter:** Skip for now.
  KV cache reuse (C6) is the higher-ROI, lower-risk win.

---

## Implementation Order

1. **Tier S (S1-S10):** All S-effort, 10-1000X. Do these first, in parallel
   across projects. One PR per project.
2. **Tier A (A1-A20):** All S-effort, 10-100X. Second wave.
3. **Tier B (B1-B17):** UI improvements, M-effort. Third wave. These are
   the "interface is the moat" items.
4. **Tier C (C1-C8):** M-effort, high impact. Fourth wave.
5. **Tier D (D1-D5):** High risk/effort. Only after everything else ships.

Each PR gets a review agent before merge.
