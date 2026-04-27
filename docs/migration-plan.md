# Cloudflare Workers Paid — Per-Project Migration Plan

**Date:** 2026-04-27
**Plan trigger:** Workers Paid ($5/mo) just purchased — unlocks Containers, Vectorize, Hyperdrive, Workflows, Email Workers, Browser Rendering, Durable Objects (no SQLite cap), Cron Triggers >1/min, R2 Class A ops at scale, Workers AI without daily caps, Queues consumer concurrency, Tail Workers.

**Scope:** 25 Fleet projects (the 22 promised + 3 monorepo siblings: agentdata-backend-prod is part of agentMode; high-signal-web/api are siblings; mentionpilot-web/api are siblings; saas-maker is the meta-project).

**Scoring:** `[Priority/Effort]` — Priority = HIGH/MED/LOW (impact × likelihood-of-actual-use), Effort = S (<2h), M (2–8h), L (>8h).

---

## agentdata-backend-prod
**Stack today:** Cloudflare Worker (TS) + `pg` over hosted Postgres (CockroachDB legacy) + OpenAI summaries + Reddit OAuth + 6h cron.
**Migrations:**
1. **[HIGH/M] Hyperdrive** — current: Worker calls `pg` directly to Cockroach, paying full TLS round-trip per request, hitting cold-start pool issues. Target: Hyperdrive in front of Postgres → connection pooling at the edge, dramatically faster cold starts. Files: `cloudflare/backend/src/index.ts` (replace `new Pool({connectionString:DATABASE_URL})` with `env.HYPERDRIVE.connectionString`).
2. **[HIGH/M] Workers AI for summaries** — current: OpenAI API for Reddit-thread summaries (~921 calls/30d, 11,969 subrequests = lots of OpenAI fanout). Target: `@cf/meta/llama-3.3-70b-instruct-fp8-fast` via `env.AI.run()` — free up to 10k neurons/day on Paid, kills the OpenAI bill. Files: AI summarizer module.
3. **[MED/S] Migrate off CockroachDB to D1** — already user policy ("never CockroachDB"). 6h cron + small dataset (cache_entries, prompts, snapshots) fits D1 cleanly. Files: schema migration + `pg` → drizzle-d1.
4. **[LOW/S] Workflows** — current: 6h cron does linear `fetch reddit → summarize → write` inline. If subreddit list grows, split into Workflow with retry per-subreddit.

## agentMode (web)
**Stack today:** Next.js 16 on Workers via `@opennextjs/cloudflare` — pure SSR client for the backend above.
**Migrations:**
1. **[LOW/S] Browser Rendering for OG images** — current: none, no OG images. Target: `/api/og/[subreddit]` route using Browser Rendering binding to render thread cards. Pure UX upgrade.

## anime_list (anime-list-web)
**Stack today:** Next.js 16 on Pages + Hono backend on Worker (`mal-api`) + Turso libSQL + daily cron 3 AM via separate `wrangler.cron.toml`. ~14.8k anime catalog refreshed via GitHub Actions.
**Migrations:**
1. **[HIGH/M] Workflows for catalog refresh** — current: daily cron in Worker fetches Jikan API in-process (CPU+wall-time ceiling on free tier). Target: Workflow steps per genre/season with automatic retry; survives 30s sub-request limits. Files: `src/worker.ts` cron handler.
2. **[HIGH/M] Vectorize for "similar anime"** — current: filter-only discovery (genre/year). Target: BGE embeddings of synopsis + Vectorize semantic search → "find anime like X". Maps directly to README's stated weakness. Files: new `/api/similar/[id]`.
3. **[MED/S] Workers AI BGE for embeddings** — pairs with #2. Replaces no current OpenAI cost, but unlocks (2) for free.
4. **[MED/M] Move from Turso to D1** — user policy preference (Turso or D1 — both fine, but D1 saves an external dep). 14.8k rows + watchlists fit D1 trivially.
5. **[LOW/S] Container for yt-dlp-style scraping** if expanding beyond Jikan — currently runs in GH Actions, no need yet.

## backpropagate
**Stack today:** Vite + React SPA, Cloudflare Pages. No backend. Pure static.
**Migrations:**
1. **[LOW/S] Turnstile** if any contact form is added — currently no public input. Skip.
   *No migration warranted today — pure static demo.*

## chess
**Stack today:** Vite + React SPA on Vercel + Express CLI bridge (`server/index.mjs`) + serverless `api/coach.ts` proxy + Stockfish WASM. Multi-provider AI (Anthropic/OpenAI/Google/DeepSeek). NOT on Cloudflare today.
**Migrations:**
1. **[HIGH/M] Move to Workers + Workers AI** — current: Vercel for `api/coach.ts` proxying paid AI APIs. Target: Worker calling Workers AI (Llama 3.3 70B) for coaching → free up to 10k neurons/day, removes Vercel hop. Files: `api/coach.ts` → new Worker.
2. **[MED/S] Durable Objects for game session state** — current: localStorage only, no shared/multiplayer. Target: optional cloud-save via DO per gameId (now feasible on Paid). Files: new DO class.
3. **[LOW/S] R2 for PGN export storage** if game-history feature added.

## clash-royale-meta
**Stack today:** Next.js 16 on Workers + static deck data. No DB, no auth. Zero traffic in 30d.
**Migrations:**
1. **[MED/S] Workers AI deck recommendations** — current: static lookup tables. Target: AI-generated counter-deck suggestions via Llama 3.3 8B. Files: new `/api/recommend`.
2. **[LOW/S] Vectorize for "similar deck" search** — only worth if user-submitted decks exist (they don't yet).

## CodeVetter
**Stack today:** Tauri desktop app (apps/desktop) + npm workspaces — README mentions Cloudflare Worker for API + review/indexing but no `wrangler.toml` in the scanned tree. The CF API shows a `codevetter` D1 (3.5MB, 85k reads/30d) + a Pages project — so it IS on CF, just lives in unscanned subdir.
**Migrations:**
1. **[HIGH/M] Vectorize for code-snippet semantic search** — current: D1 keyword/SQL only (341k row-reads/30d suggests heavy scan). Target: embed reviewed code chunks → semantic "have we flagged this pattern before?". Files: review-service indexer.
2. **[HIGH/M] Workers AI for code review** — current: BYOK Anthropic/OpenAI/OpenRouter (paid). Target: Llama 3.3 70B for first-pass triage, fall back to user's BYOK only on uncertainty. Slashes user-side cost.
3. **[MED/S] Queues for async review jobs** — desktop app submits PR diffs; current is sync. Queue → consumer worker → push result back via DO/WebSocket. Files: new producer in apps/desktop, consumer in workers/review.
4. **[LOW/M] Container for sandboxed code-execution** (running suspicious snippets safely) — only if product expands that direction.

## email-manager
**Stack today:** Next.js 16 on Workers + better-auth + D1 (`email-manager-auth`) + Drizzle + `@huggingface/transformers` (in-browser/edge) + Turso for app data. **Has Workers AI plumbing but no email ingestion code yet.**
**Migrations:**
1. **[HIGH/M] Email Workers** — current: README says "email manager" but no IMAP/email ingress code anywhere. Target: configure email routing → Worker handler that parses inbound mail with `EmailMessage`/`postal-mime`, persists to D1. **This is the project's whole missing feature.** Files: new `src/email-handler.ts` + wrangler `email_routing` config.
2. **[HIGH/M] Workers AI for email classification** — pair with #1: Llama 3.3 8B for "is this newsletter / receipt / personal" labelling on ingest. Replaces the dead `@huggingface/transformers` dep that probably doesn't run in Workers runtime today.
3. **[MED/S] Vectorize for email semantic search** — embed each ingested email; "find that email about taxes from March" without keyword search.
4. **[MED/S] R2 for attachments** — current: none. Target: extract attachments → R2 (R2 bucket binding).
5. **[LOW/M] Workflows for daily digest** — multi-step "summarise inbox → email digest → mark read".
6. **[LOW/S] Migrate Turso → D1** — collapse to one DB binding.

## everythingrated
**Stack today:** Next.js 16 + Drizzle + D1 (`everythingrated-db`, 76 KB). Anonymous ratings via cookie. ~25 reads/30d — basically idle.
**Migrations:**
1. **[MED/S] Workers AI for "AI summary of reviews"** — target: synth a 1-paragraph product summary from all ratings via Llama 3.3 8B. Files: new `/api/summary/[toolId]`.
2. **[MED/S] Vectorize for "similar tools"** — embed tool descriptions; semantic discovery.
3. **[LOW/S] Turnstile** — current: cookie-only spam protection. Target: gate `/api/rate` with Turnstile invisible widget — better than the ad-hoc cookie. Files: rating form + server action.

## free-ai-gateway
**Stack today:** Hono on Workers + Workers AI + KV health snapshots + D1 analytics + **declares Durable Objects (`HealthStateDO`, `IpRateLimitDO`) in wrangler.toml that need Paid plan to actually deploy**. 16,607 req/30d — top traffic. Multi-provider router (Groq, Gemini, Cerebras, Voyage, OpenRouter, etc.).
**Migrations:**
1. **[HIGH/S] DEPLOY THE EXISTING DURABLE OBJECTS** — current: code is written, wrangler config declares them, but they don't run on Free. Just `wrangler deploy` post-Paid → instantly unlocks rolling-window health tracking + per-IP rate limiting. **This is the highest single-line ROI in the entire fleet.**
2. **[HIGH/M] Workflows for embedding/chat fallback chains** — current: provider failover is in-request retry loop. Target: Workflow with step-per-provider, automatic backoff, durable across CPU-time limits.
3. **[MED/S] Tail Workers for cross-project request logging** — Paid unlocks `wrangler tail` reliably; build a tail worker that ships request metadata to Analytics Engine. Then every Fleet project that consumes this gateway gets free observability.
4. **[MED/M] Containers for self-hosted models** — long-term: run a small local model (e.g., quantized Llama 3.2 3B) in a Container as a free-tier provider in the rotation, so the gateway has guaranteed fallback when external free providers rate-limit.
5. **[LOW/S] Vectorize for embedding cache** — dedup repeated embedding requests.

## high-signal-api
**Stack today:** Hono on Workers + D1 (`high-signal-db`, 43 MB — biggest in fleet, 98k reads/30d) + Drizzle + daily cron @ 6 UTC + Python ingest via Modal (edgartools, GLiNER, FinBERT, yfinance). NextAuth + Google. Service binding from web → api.
**Migrations:**
1. **[HIGH/L] Containers to replace Modal sidecar** — current: Python ingest (GLiNER NER, FinBERT sentiment, edgartools SEC scraping, Trafilatura, yfinance) runs on Modal ($/req). Target: Cloudflare Container running same Python image, triggered by Worker cron. Drops Modal dep, keeps everything in CF. Files: `python/ingest/` → `Containerfile`.
2. **[HIGH/M] Vectorize for signal similarity** — current: no semantic search across 274 entities + signals. Target: embed each signal card → "show me past signals like this one" — directly enables the "spillover graph" promise in the README.
3. **[HIGH/M] Workers AI for signal extraction** — current: external `AI_BASE_URL`/`AI_API_KEY` (paid). Target: Llama 3.3 70B via binding for entity/event extraction during cron.
4. **[MED/M] Workflows for ingest pipeline** — current: cron does fetch-SEC → extract → score → write inline (CPU-time risk on 274-entity batch). Target: Workflow with step per source class.
5. **[MED/S] Queues for backtesting** — auto-score every signal hit-rate as a queue consumer.

## high-signal-web
**Stack today:** Next.js 16 on Workers + service binding to high-signal-api. No DB on the web side.
**Migrations:**
1. **[MED/S] Browser Rendering for OG images** — current: no per-signal OG cards. Target: `/og/[signalId]` rendering signal-card to PNG. Big share-ability win for a research artifact.
2. **[LOW/S] Turnstile on the (future) waitlist form** — when user-facing CTAs land.

## linkchat
**Stack today:** Next.js 16 on Workers + better-auth + D1 (`linkchat-auth`, empty) + Drizzle + Turso for app data + R2 (`linkchat-images`, 1 object) + `@aws-sdk/client-s3` (presigned upload pattern over R2 via S3-compat) + `@ai-sdk/openai-compatible`. **Zero traffic 30d.**
**Migrations:**
1. **[HIGH/S] Use R2 binding directly, drop @aws-sdk/client-s3** — current: 3.1 MB AWS SDK in the bundle for S3-style presigned URLs against R2. Target: `env.R2.put()` direct binding → smaller bundle, faster cold start, no AWS SDK perf tax. Files: `src/lib/r2.ts`.
2. **[MED/M] Vectorize + Workers AI for image semantic search** — pair: Workers AI image-embedding model → Vectorize → "find images like this one". Files: new `/api/search/image`.
3. **[MED/S] Migrate Turso → D1** — collapse storage.
4. **[LOW/S] Durable Objects for live chat sessions** — if the "chat" piece becomes real-time.

## looptv
**Stack today:** Next.js 16 on Workers + `stations.json` static + yt-dlp (offline catalog build) + HuggingFace `dslim/bert-base-NER` for tagging (run in GitHub Actions). ~38k videos, no DB.
**Migrations:**
1. **[HIGH/M] Workers AI BGE for tagging** — current: HuggingFace bert-NER in GH Actions runner (slow, model load every run). Target: `@cf/baai/bge-base-en-v1.5` for embeddings + `@cf/huggingface/distilbert-sst-2-int8` for classification, called at video-import time directly. Files: `scripts/tag-videos.mjs` → Workers handler.
2. **[HIGH/L] Container for yt-dlp catalog refresh** — current: README requires user to install yt-dlp locally and run `bash scripts/build-catalog.sh`. Target: Container runs yt-dlp on schedule, writes results to D1/R2. Removes the "user must run scripts" friction.
3. **[MED/M] D1 for video catalog** — current: static JSON. Target: D1 table → enables per-user history + better filtering.
4. **[MED/M] Vectorize for "similar videos"** — embed titles+descriptions → semantic recommendations. Pairs with #1.

## mentionpilot-api
**Stack today:** Hono on Workers + D1 (`mentionpilot-db`, 204 KB, low traffic) + daily cron @ 6 UTC + Reddit/HackerNews/ProductHunt monitors + `@ai-sdk/openai-compatible`. **Has Reddit/HN/PH monitors that run inline on cron.**
**Migrations:**
1. **[HIGH/M] Queues for monitor fan-out** — current: cron loops sources sequentially in one invocation (CPU ceiling risk as brand list grows). Target: producer queues one message per (brand, source), consumer worker processes 1-by-1 with retry. Files: `src/lib/reddit-monitor.ts`, `ph-monitor.ts`, `hn-monitor.ts`.
2. **[HIGH/M] Vectorize for mention deduplication** — current: probably string-equality dedup. Target: embed each mention → cosine-similarity dedup catches paraphrases.
3. **[HIGH/M] Workers AI for mention classification** — current: external AI provider for "is this mention about brand X / sentiment". Target: Llama 3.3 8B via binding.
4. **[MED/S] Workflows for "weekly digest" emails** — multi-step build → send → log.
5. **[LOW/S] Browser Rendering for badge widget screenshots**.

## mentionpilot-web
**Stack today:** Next.js 16 on Workers + better-auth + shares D1 with api + `@ai-sdk/openai-compatible`. 10 req/30d.
**Migrations:**
1. **[MED/S] Turnstile on landing CTAs** — current: no bot protection on free-check form. Target: gate `/free-check` and signup. Files: `apps/web/e2e/free-check.spec.ts` shows there is one.
2. **[LOW/S] Browser Rendering for branded share images.**

## open-historia
**Stack today:** Next.js 16 on Workers + Anthropic + Google Gemini + OpenAI (BYOK across providers) + better-auth + D1 (auth, empty 12 KB) + Turso (game state) + Drizzle. Strategy game with AI game-master.
**Migrations:**
1. **[HIGH/M] Workers AI as default game-master** — current: 3 paid AI SDKs + DEV mode. Target: Llama 3.3 70B as default "free" provider; BYOK as opt-in for higher-fidelity narration. Files: `app/api/turn/route.ts`, `chat/route.ts`, `advisor/route.ts`.
2. **[HIGH/L] Durable Objects for game sessions** — current: state in Turso, every turn = full read/write. Target: one DO per game = in-memory active state, persist only on milestones. Massive latency win for the "advance time" UX.
3. **[MED/M] Workflows for AI-driven turn resolution** — multi-step: gather state → AI adjudicate → AI generate events → AI nation reactions → write back. Currently inline, hits CPU caps with large maps.
4. **[MED/M] Vectorize for "find similar past turns"** — embed turn outcomes → enables "rewind to forks" + AI consistency.
5. **[LOW/S] R2 for save-game exports.**
6. **[MED/S] Turso → D1** — already has D1 for auth, collapse.

## reader (Web Annotator)
**Stack today:** Next.js 16 on Workers + better-auth + Turso + Drizzle + R2 (`reader-pdfs`, empty) + `@aws-sdk/client-s3` for R2-S3-compat + `@ai-sdk/openai-compatible` (BYOK chat). Mozilla Readability for article extraction. PDF support.
**Migrations:**
1. **[HIGH/S] R2 binding direct, drop @aws-sdk/client-s3** — same as linkchat. Bundle bloat for nothing. Files: `src/lib/storage.ts`.
2. **[HIGH/M] Workers AI BGE embeddings + Vectorize for full-text search** — current: README says "Full-Text Search" but it's likely SQL LIKE/FTS5. Target: embed each article + each note → semantic Cmd+K search across "articles, notes, and AI chat". Files: `src/lib/articles-db.ts`.
3. **[HIGH/M] Workers AI for summaries + key-points** — current: BYOK paid model for "Auto-Summaries" + "Key Points Extraction". Target: Llama 3.3 70B via binding — free, removes BYOK requirement for the headline feature.
4. **[MED/M] Browser Rendering for article extraction** — current: Readability runs server-side fetching the URL with raw fetch (bot-walls, JS-rendered sites fail). Target: Browser Rendering binding fetches+evaluates → reliable extraction. Big quality win.
5. **[MED/S] Workflows for "import article" pipeline** — fetch → extract → embed → summarize → save (currently inline).
6. **[MED/S] Migrate Turso → D1** for collapse.
7. **[LOW/S] Email Workers** — "send any URL via email to add to library" pattern.

## resume-tailor (RolePatch)
**Stack today:** Next.js 16 on Workers + Turso + NextAuth + better-auth + `@sparticuz/chromium` + `puppeteer-core` (in deps but Workers runtime doesn't run them — currently broken) + jsdom + Vercel AI SDK + JobSpy Python sidecar.
**Migrations:**
1. **[HIGH/L] Container OR Browser Rendering for job-page scraping** — current: `@sparticuz/chromium` + `puppeteer-core` in package.json but **cannot run in Workers runtime today** — this is the project's biggest broken feature. Target: Browser Rendering binding for simple sites, Container with full Puppeteer for SPAs/auth-walled sites (LinkedIn). Pick Browser Rendering first (cheaper, simpler).
2. **[HIGH/L] Container for JobSpy Python sidecar** — current: separate `jobspy-service/` Python service — README says "JOBSPY_SERVICE_URL" → externally hosted. Target: Cloudflare Container running JobSpy → no external dep.
3. **[HIGH/M] Workers AI for resume tailoring + cover letters** — current: `AI_BASE_URL`/`AI_API_KEY` (external). Target: Llama 3.3 70B for tailoring (it's the literal product). Files: `src/lib/actions/`.
4. **[MED/M] Vectorize for "match resume to role"** — embed resumes + JDs → fit-score becomes vector similarity instead of LLM-only.
5. **[MED/S] Workflows for the tailor pipeline** — scrape → analyze → tailor → score → cover letter (currently 5 sequential server actions).
6. **[MED/S] R2 for generated PDFs.**
7. **[LOW/S] Turso → D1.**

## significanthobbies
**Stack today:** Next.js 16 on Workers (custom domain `significanthobbies.com`) + Prisma + Turso + better-auth + Google. 173 req/30d, p99 944ms (heaviest p99 in fleet).
**Migrations:**
1. **[HIGH/M] Investigate p99 944ms first** — Prisma in Workers is famously slow due to query-engine. Target: replace Prisma with Drizzle (matching rest of fleet). Single biggest perf win — likely halves p99. Files: `src/server/db.ts`, `prisma/`.
2. **[MED/M] Workers AI for "discover what to explore next"** — README's tagline. Target: Llama 3.3 70B reads user's hobby phases → suggests adjacent hobbies.
3. **[MED/M] Vectorize for hobby semantic clustering** — embed hobby names + descriptions → enables real "similar hobbies" rec.
4. **[LOW/S] Turso → D1.**
5. **[LOW/S] Browser Rendering for shareable journey OG images.**

## starboard
**Stack today:** Next.js 16 on Workers + NextAuth (GitHub) + Turso + Workers AI binding (`AI`, already in wrangler.jsonc!) + embedding seed script. **Already wired for Workers AI** — just 1 invocation in 30d.
**Migrations:**
1. **[HIGH/S] Vectorize for embedding storage** — current: comment in wrangler.jsonc says "AI binding replaces the AI Gateway HTTP layer for embeddings". Target: stop storing embeddings as Turso BLOBs (slow), put them in Vectorize index. Files: `src/db/seed-embeddings.ts`, `src/app/api/repos/[repoId]/similar/route.ts`.
2. **[HIGH/M] Queues for batch embedding seed-popular GH Action** — current: `scripts/seed-popular.ts` runs in Node-on-GHA, hits HTTP. Target: queue per-repo embedding jobs to consumer worker.
3. **[MED/S] Workers AI for repo categorization** — current: README says "Smart Categories — Auto-categorize repos (AI/ML, Frontend, DevOps, etc.)" — likely keyword-based today. Target: Llama 3.3 8B classifier.
4. **[LOW/S] Workflows for nightly star-sync of all signed-in users.**
5. **[LOW/S] Turso → D1.**

## swe-interview-prep (Interview Coder)
**Stack today:** Vite + React SPA on Vercel + Express CLI bridge + `api/ai/chat.ts` Vercel function + Turso + Anthropic/OpenAI/OpenAI-compatible AI SDKs. NOT on CF Workers today (Pages project exists but minimal).
**Migrations:**
1. **[HIGH/M] Move serverless AI route to Workers + Workers AI** — current: Vercel function with paid Anthropic/OpenAI BYOK. Target: Worker + Llama 3.3 70B binding for Socratic hints. Files: `api/ai/chat.ts`.
2. **[MED/M] Vectorize for concept-index semantic search** — `package.json` has `build-concept-index` script. Target: embed each concept → semantic flashcard linkage.
3. **[MED/S] D1 for SRS data** — currently Turso; collapse.
4. **[LOW/M] Container for code-execution sandbox** — README says "Interactive Code Editor — Write and run TypeScript code". If you ever execute submitted code server-side, Containers (Sandbox SDK) is the right tool.

## today-little-log
**Stack today:** Vite + React SPA + Vercel serverless `functions/api/` + Turso + better-auth. Pages project on CF (`today-little-log`).
**Migrations:**
1. **[MED/M] Move Vercel functions to Workers + Workers AI** — `functions/api/auth/[[all]].ts` is already on CF Pages. Add Workers AI for "summarize my week" / "daily reflection" features.
2. **[MED/S] D1 for user data** — collapse Turso.
3. **[LOW/S] Browser Rendering for shareable journal-streak OG images.**
4. **[LOW/S] Turnstile on signup.**

## truehire
**Stack today:** Next.js 16 on Workers + NextAuth (GitHub) + Drizzle + Turso + GitHub PAT for ingest. Has `apps/web/src/app/api/og/[handle]/route.tsx` — ALREADY uses Next.js OG.
**Migrations:**
1. **[HIGH/M] Workers AI for GitHub-signal scoring** — current: deterministic GitHub stats → 0-100 score. Target: Llama 3.3 70B reads top repos' READMEs/code, augments score with "depth of work" signal. Files: `packages/core/src/scoring/`.
2. **[HIGH/M] Vectorize for "similar candidates" / "find matching role"** — embed candidate profiles → semantic recruiter search. Core product unlock.
3. **[MED/M] Workflows for nightly GitHub recompute** — current: README implies "batch weekly recomputes" via app PAT. Target: Workflow per-handle with backoff for GH rate-limits.
4. **[MED/S] Browser Rendering replaces Next OG route** — Next's `route.tsx` OG is fine but Browser Rendering with full Tailwind is richer for `/@handle` shares.
5. **[MED/M] Container for GitHub clone+analyze** — if scoring grows beyond API into "actually run linters on top repos".
6. **[LOW/S] Turso → D1.**
7. **[LOW/S] Turnstile** on signup.

## saas-maker (Foundry)
**Stack today:** Hono Worker (`saasmaker-api`) + D1 (`saasmaker-db`, 524KB, 3k reads/30d) + R2 (`saasmaker-feedback-images`, empty but 110 GET/30d) + Workers AI binding already declared + Next.js cockpit (`saasmaker-dashboard`) + showcase + analytics-ui. Uses Resend for email. Custom domain `api.sassmaker.com`.
**Migrations:**
1. **[HIGH/M] Email Workers replace Resend** — current: Resend for notifications (paid above free tier). Target: Email Workers for transactional sends (free on Paid). Files: `packages/blocks/email/src/providers/resend.ts` → new `cf-email.ts` provider.
2. **[HIGH/M] Workers AI for `@saas-maker/ai` block** — current: `@ai-sdk/openai-compatible` + `FREE_AI_BASE_URL` (relies on free-ai-gateway round-trip). Target: direct Workers AI binding for first-party calls; gateway-only for fleet projects that use the SDK. Saves a network hop on every internal call.
3. **[HIGH/M] Vectorize for cross-project feedback semantic search** — current: feedback widget collects text, no search. Target: embed feedback items → "show me feedback similar to this" across all 22 projects in the cockpit. Massive product moat.
4. **[MED/M] Workflows for `fnd fleet audit` background runs** — current: CLI-only. Target: Worker + Workflow runs audit on cron, surfaces in cockpit.
5. **[MED/M] Queues for analytics event ingestion** — current: PostHog ingest direct. Target: queue batch + flush — smoother PostHog cost curve.
6. **[MED/S] Investigate the 110 GET / 70 HeadBucket on saasmaker-feedback-images bucket** — empty bucket but ops happening = either legitimate-but-broken (404 path) or stale code. Quick win to fix.
7. **[LOW/S] Turnstile on cockpit login.**
8. **[LOW/S] Browser Rendering** for showcase OG images.

---

# Top 10 Highest-Leverage Migrations Across Fleet

Sorted by impact × likelihood-of-actual-completion. Each is a single, bounded change.

| # | Migration | Project | Impact | Effort | Why this rank |
|---|---|---|---|---|---|
| 1 | **Deploy free-ai-gateway's existing Durable Objects** | free-ai-gateway | HIGH | S | Code already written; Paid plan unblocks `wrangler deploy`. ~16k req/30d immediately get rolling-window health + per-IP rate limit. Single highest ROI in the fleet. |
| 2 | **Replace Prisma with Drizzle in significanthobbies** | significanthobbies | HIGH | M | p99 = 944ms (worst in fleet). Prisma-on-Workers is the known cause. Half the rest of the fleet already runs Drizzle — proven pattern. |
| 3 | **Drop @aws-sdk/client-s3 for R2 binding (linkchat + reader)** | linkchat, reader | HIGH | S | 3.1MB AWS SDK bloat for nothing. Two projects × one PR each. Cold-start + bundle-size win. |
| 4 | **Workers AI replaces external AI providers in resume-tailor** | resume-tailor | HIGH | M | Core product (resume tailoring) currently external-paid; Llama 3.3 70B does it for free. 89 req/30d but growing. |
| 5 | **Container for resume-tailor's JobSpy + Puppeteer scraping** | resume-tailor | HIGH | L | Project's `puppeteer-core` + `@sparticuz/chromium` deps don't run on Workers — feature is broken today. Container fixes it without leaving CF. |
| 6 | **Container for high-signal-api Python ingest (replace Modal)** | high-signal-api | HIGH | L | Eliminates Modal sidecar. Cron-driven, predictable cost. 43MB D1 already biggest in fleet — pipeline is real. |
| 7 | **Workers AI + Vectorize for reader semantic search** | reader | HIGH | M | README promises "Full-Text Search across articles, notes, AI chat" — semantic search is a category-defining feature for a research-library product. |
| 8 | **Email Workers + Workers AI for email-manager** | email-manager | HIGH | M | The project IS an email manager but has zero email-ingestion code. Email Workers + AI classifier ships the missing core feature in one sprint. |
| 9 | **Workers AI default for open-historia game-master** | open-historia | HIGH | M | Removes the "you must bring your own API key" friction from the headline feature. BYOK becomes opt-in for premium users instead of mandatory. |
| 10 | **Vectorize + Workers AI in saas-maker for cross-project feedback search** | saas-maker | HIGH | M | Cockpit becomes a cross-Fleet ML surface. Demoable, sticky, and exactly the kind of capability that justifies a "Foundry" pitch. |

**Estimated total effort for top 10:** 5×M + 3×L + 2×S ≈ **38–55 hours** (~1 focused week). Realistic split: ship items 1, 3, 4, 7, 9 first (S/M only, ~14h, 5 user-visible wins in week 1), tackle the 3 Container migrations (5, 6, plus high-signal Workflows) over weeks 2–3.

**Cross-cutting next-step (not in the top 10 but applies to 8+ projects):** standardize on **Drizzle + D1** and rip out Turso wherever it's just used for app data. User policy already says "Turso or D1, never Supabase/CockroachDB" — D1 collapses one external dep, gets you free `wrangler d1` tooling, and integrates with Workflows/Queues without HTTP hop.
