# New things to learn — saas-maker

Novel Cloudflare primitives and patterns powering The Foundry: Containers, Droids, orchestration, and auth.

---

## CF Containers (beta)
- What: Durable Objects that back a full Linux container instead of just JS state.
- Why here: TBD
- Gotcha (from code): `Sandbox` is declared as both a DO class *and* a containers entry — the DO is the lifecycle handle; the container is the actual process. Two concepts, one class name. (`workers/droid/wrangler.jsonc` lines 19, 28)
- Source: https://developers.cloudflare.com/containers/

## DO + Container pattern (`@cloudflare/sandbox`)
- What: `getSandbox(ns, id)` wraps a Container-backed DO, waiting for port readiness before yielding it.
- Why here: TBD
- Gotcha (from code): `containerTimeouts.portReadyTimeoutMS` is set to 240 s — containers take a lot longer to boot than plain DOs; callers must budget for this. (`workers/droid/src/executor.ts:285`)
- Source: https://github.com/cloudflare/sandbox

## DeepSeek as autonomous runner LLM
- What: `deepseek-v4-pro` drives the Droid's native agent loop; `deepseek-chat` handles the PR review gate.
- Why here: TBD
- Gotcha (from code): Both model identifiers are env-var overridable but the defaults are hard-coded at `workers/droid/src/executor.ts:49-50`; the wrangler.jsonc vars are the prod override path.
- Source: https://api-docs.deepseek.com/

## AGENTS.md injection as prompting
- What: Droid shells into the sandbox, reads the repo's `AGENTS.md`, and injects it verbatim into the DeepSeek context — no DB, no config UI.
- Why here: TBD
- Gotcha (from code): Only the first 220 lines of `AGENTS.md` are injected (`sed -n "1,220p"`), so anything below that line is invisible to the model. (`workers/droid/src/executor.ts:527`)
- Source: internal — `workers/droid/src/executor.ts:515-528` (context hydration script)

## Durable Objects with embedded SQLite (`new_sqlite_classes`)
- What: DO migrations can declare `new_sqlite_classes` to give each DO instance its own SQLite database via the Storage API.
- Why here: TBD
- Source: https://developers.cloudflare.com/durable-objects/api/sql-storage/

## better-auth (vs Auth.js v5)
- What: Lightweight, framework-agnostic auth library with a Drizzle adapter; issues opaque session tokens stored directly in D1.
- Why here: TBD
- Gotcha (from code): The API worker has no better-auth dependency — it resolves sessions by raw SQL against the shared D1 `session` table, so the two services stay decoupled. (`workers/api/src/middleware/auth.ts:28-48`; no `better-auth` in `workers/api/package.json`)
- Source: https://www.better-auth.com/docs

## Hono on Cloudflare Workers
- What: Ultralight web framework with first-class Workers support, typed middleware, and zero cold-start overhead.
- Why here: TBD
- Source: https://hono.dev/docs/getting-started/cloudflare-workers

## R2 for binary assets
- What: S3-compatible object store bound to Workers without egress fees; used here for feedback images.
- Why here: TBD
- Source: https://developers.cloudflare.com/r2/

## D1 as the shared auth + app database
- What: Cloudflare's serverless SQLite-over-HTTP, shared across the API worker and the cockpit Next.js app via Drizzle.
- Why here: TBD
- Source: https://developers.cloudflare.com/d1/

## Symphony orchestration model
- What: Task-backed orchestration layer — cockpit `/v1/tasks` is the source of truth; `pnpm symphony dispatch` routes a task to an agent (Claude, Gemini, Grok, Droid).
- Why here: TBD
- Source: internal — `docs/symphony.md` (full spec); `scripts/symphony-local.mjs` (runner)

## DroidRunRoom (DO as run-queue / pub-sub)
- What: A second DO class (`DroidRunRoom`) serializes concurrent runs per repo and streams live events to cockpit via WebSockets.
- Why here: TBD
- Gotcha (from code): Transport is WebSockets only — `ctx.acceptWebSocket` + `ctx.getWebSockets()` per `workers/droid/src/run-room.ts:118-137`; no SSE path exists.
- Source: https://developers.cloudflare.com/durable-objects/

## Cloudflare Browser Rendering API
- What: Puppeteer-compatible headless browser bound as a Worker binding (`BROWSER`) for screenshot-based acceptance checks.
- Why here: TBD
- Source: https://developers.cloudflare.com/browser-rendering/
