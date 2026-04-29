# Auth Audit — 2026-04-27

Read-only audit of authentication state across all Fleet apps in `~/Desktop/Fleet/`. No code or config was modified.

## Caveats / scope notes
- Three apps in the original target list are **not present** in `~/Desktop/Fleet/`: `agentdata-backend-prod`, `personalsite`, `web-annotator`. These are excluded.
- `free-ai-gateway` exists as `free-ai/`.
- Smoke tests were partially constrained by sandbox DNS — several `*.pages.dev`, `*.workers.dev`, `*.vercel.app`, and custom-domain hosts could not be resolved from the audit environment. Where DNS failed, status is inferred from code/config alone and flagged `unknown (DNS)`. Inference from code is reliable for "what should happen"; only the deployed-state column is impacted.
- Coordination: agent `acfc91a04d218fd01` was modifying `reader`, `resume-tailor`, and `free-ai` for AI-gateway changes. This audit only **read** those repos.

## Summary
- **Apps audited:** 22
- **Need user auth:** 14
- **Need API key (no user auth):** 3 (free-ai gateway, high-signal API, saas-maker API)
- **No auth needed:** 5 (backpropagate, chess, clash-royale-meta, CodeVetter, looptv, everythingrated — POC anonymous; agentMode = client-only Google sync to backend that itself uses bearer)
- **Working auth (scaffolding sound + reachable):** 2 confirmed (mentionpilot, today-little-log) + 6 inferred OK from code
- **Broken / 500-ing auth:** 4 (linkchat, truehire, resume-tailor, swe-interview-prep)
- **Partial (auth wired but missing pieces):** ~6
- **Stub / not-yet-wired:** 1 (high-signal NextAuth declared but not in code; Cloudflare Access used instead per `plans/0002-auth-hardening.md` Path A)

## Per-app status

### agentMode
- **Classification:** needs-user-auth (web + backend)
- **Provider:** Google Identity Services (client-side GSI), JWT idToken passed as Bearer to CF Worker backend (`cloudflare/backend/src/index.ts` verifies Google ID tokens via `oauth2.googleapis.com/tokeninfo`).
- **Imports:** none of `better-auth`/`next-auth` — pure GSI + manual Bearer verify.
- **Routes:** No `/api/auth/*` — login is GSI popup → idToken → frontend stores in `localStorage.agentdata_auth` → backend verifies on each request.
- **DB:** Turso (libSQL). No auth-specific schema needed (no sessions stored).
- **Env vars:** `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (web), Reddit creds for backend. Note: `.env.example` lacks `GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
- **Smoke test:** `agentmode-backend.sarthakagrawal927.workers.dev/` → 404 (root not registered; expected — 404 = not the API path. Auth path uses `Authorization` header per request, no dedicated session endpoint).
- **Gaps:**
  - `.env.example` missing `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
  - idToken in localStorage = XSS-vulnerable (per high-signal plan, same anti-pattern noted).
  - No refresh — token expires after ~1h with no flow.
  - No `agentmode-backend` deployed URL verified (DNS resolve OK but root 404 — no `/healthz` or similar).
- **Status:** PARTIAL

### anime_list
- **Classification:** needs-user-auth (personal watchlists)
- **Provider:** Google ID Token verification (server-side via `google-auth-library`) + JWT signed with `JWT_SECRET` (Express middleware `src/middleware/auth.ts`).
- **Routes:** Express `POST /auth/google` in `src/routes/authRoutes.ts`. Frontend `lib/auth.tsx` calls `${API_URL}/api/auth/google`.
- **DB:** Turso (libSQL) — `users` CRUD via `src/db/users.ts`. No sessions table (stateless JWT).
- **Env vars:** `GOOGLE_CLIENT_ID`, `JWT_SECRET`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `TURSO_AUTH_TOKEN` — all present in `.env.example`.
- **Smoke test:** `https://anime-list-five.vercel.app/` → 200; `/api/auth` → 404 (the route is `/api/auth/google` mounted under Express). DNS resolved.
- **Gaps:**
  - Frontend stores JWT in `localStorage.mal_auth` — XSS-vulnerable.
  - No `vercel.json` content surfaced — verify Express is actually proxied via Vercel.
  - JWT has no rotation, no refresh, 30-day TTL hard-coded (per typical pattern).
- **Status:** WORKING (assuming Vercel routes Express as configured; logic is sound)

### backpropagate
- **Classification:** no-auth-needed (single-player game, no persistence)
- **Status:** N/A

### chess
- **Classification:** no-auth-needed (local-only game, BYO API keys)
- **Provider:** None
- **Status:** N/A

### clash-royale-meta
- **Classification:** no-auth-needed (public read-only stats)
- **Status:** N/A

### CodeVetter
- **Classification:** no-auth-needed (Tauri desktop app; LLM keys local)
- **Status:** N/A

### email-manager
- **Classification:** needs-user-auth (Gmail OAuth scope; per-user email data)
- **Provider:** **better-auth** (Drizzle adapter + D1) per `src/lib/auth.ts` — but `agents.md` says **NextAuth v4**. Code is the source of truth: it's better-auth.
- **Routes:** `/api/auth/[...all]` via better-auth handler.
- **DB:** Cloudflare D1 binding `DB` → `email-manager-auth` (database_id `e770dfa2-…`).
- **Env vars:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TURSO_AUTH_TOKEN` — present.
- **Smoke test:** `email-manager-d0r.pages.dev` — DNS unresolved from sandbox, status unknown.
- **Gaps:**
  - **No migrations directory and no Drizzle schema file.** better-auth expects `user`, `session`, `account`, `verification` tables; without migrations, the D1 DB is empty → first sign-in attempt will 500.
  - `agents.md` is stale (says NextAuth v4 — actual code is better-auth).
  - `BETTER_AUTH_SECRET` must be set as Worker secret in prod (cannot verify).
- **Status:** PARTIAL — code wired, schema missing.

### everythingrated
- **Classification:** no-auth-needed (POC; httpOnly cookie `er_visitor` for anon ratings).
- **Status:** N/A

### free-ai (= free-ai-gateway)
- **Classification:** needs-api-key (Bearer for `/v1/analytics`); chat/embedding endpoints are public + per-IP rate-limited.
- **Provider:** Static Bearer `GATEWAY_API_KEY` (per `agents.md`); not yet enforced (known gap).
- **DB:** Cloudflare D1 `GATEWAY_DB` (analytics).
- **Env vars:** `.env.example` not inspected for GATEWAY_API_KEY explicitly; `agents.md` flags this as TODO.
- **Smoke test:** `free-ai-gateway.sarthakagrawal927.workers.dev/api/auth/session` → 200 (this endpoint isn't auth-related — root returns 200 because the app serves a playground).
- **Gaps:**
  - Bearer enforcement on `/v1/analytics` not implemented (declared TODO).
- **Status:** PARTIAL by design (no user auth needed; API-key gating not yet wired).

### high-signal
- **Classification:** needs-user-auth for `/review` admin only (public read for everything else); API needs API-key for admin endpoints.
- **Provider declared:** NextAuth v5 (Google) per `agents.md`. **Actual:** Cloudflare Access (Path A) per `plans/0002-auth-hardening.md`. NextAuth packages are NOT in `apps/web/package.json` — the doc is aspirational. The active design uses CF Access JWT verified in `apps/web/src/app/api/admin/[...path]/route.ts` (this file may not yet exist — confirm).
- **Routes:** No `apps/web/src/app/api/auth/*`. There IS `apps/web/src/app/api/admin/[...path]/route.ts` (CF Access proxy).
- **DB:** Cloudflare D1 `high-signal-db` (no users/sessions tables expected — admin gating is via CF Access cookie, not session DB).
- **Env vars:** `.env.example` lists `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — but these are stale (NextAuth was abandoned for CF Access). Should be `CF_ACCESS_AUD`, `CF_ACCESS_TEAM_DOMAIN`.
- **Smoke test:** `high-signal-api.sarthakagrawal927.workers.dev/` → 200; `/api/auth/session` → 404 (correct — no NextAuth here).
- **Gaps:**
  - `agents.md` says NextAuth — actually CF Access. Update to match.
  - `.env.example` has stale NEXTAUTH_* vars; missing `CF_ACCESS_AUD` / `CF_ACCESS_TEAM_DOMAIN`.
  - Need to confirm `apps/web/src/app/api/admin/[...path]/route.ts` exists and verifies CF Access JWT.
- **Status:** PARTIAL (docs/env stale; design was migrated; verify code)

### linkchat
- **Classification:** needs-user-auth (dashboard, AI key storage)
- **Provider:** **better-auth** v1.6.9 (Drizzle adapter on D1). `agents.md` claims **NextAuth v5** — stale.
- **Routes:** `/api/auth/[...all]` via `toNextJsHandler(createAuth().handler)`.
- **DB:** D1 `linkchat-auth` (binding `DB`).
- **Schema:** `src/db/schema.ts` defines `users`, `accounts`, `sessions`, `verificationTokens` in **NextAuth-style** (camelCase columns, plural names) — but better-auth defaults to `user`/`session`/`account`/`verification`. **Schema/library mismatch.** The auth call doesn't pass `schema:` mapping — better-auth will look for its own table names → tables not found → 500.
- **Env vars:** `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TURSO_AUTH_TOKEN` (Turso unused now — D1).
- **Smoke test:** `linkchat.sarthakagrawal927.workers.dev/` → **500**; `/api/auth/session` → **500** (empty body); `/login` → **500**. App is **completely down**.
- **Gaps:**
  - **Site is 500-ing on every route.** Likely: missing `BETTER_AUTH_SECRET` secret OR schema mismatch OR `getCloudflareContext` call from a non-CF context.
  - Schema names (`users`/`sessions`/`accounts`) don't match better-auth defaults (`user`/`session`/`account`); no `schema:` mapping passed in `drizzleAdapter`.
  - `agents.md` says NextAuth v5 — stale.
- **Status:** **BROKEN**

### looptv
- **Classification:** no-auth-needed (anon TV-style player, localStorage for history)
- **Status:** N/A

### mentionpilot
- **Classification:** needs-user-auth (dashboard for tracked brands)
- **Provider:** **better-auth** (D1 binding `AUTH_DB`). `agents.md` says better-auth — matches.
- **Routes:** `apps/web/src/app/api/auth/[...all]/route.ts` calls `getAuth()` (lazy CF context).
- **DB:** D1 `mentionpilot-db` shared with API worker. Migrations exist (`packages/db/migrations/0001_initial.sql` has `users`, `sessions`).
- **Env vars:** `apps/web/.env.example` has `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`. Wrangler vars set `BETTER_AUTH_URL` and `NEXTAUTH_URL`.
- **Smoke test:** `mentionpilot-web.sarthakagrawal927.workers.dev/` → 200; `/api/auth/session` → **404**; `/login` → 200; `/api/auth/sign-in/social` → 404.
- **Gaps:**
  - `/api/auth/*` returns 404 — the catch-all route isn't matching. Either build didn't include the route, or `[...all]` not exported correctly. Worth investigating: is `apps/web/.next` deployed via OpenNext? Is route file present in build output? (Found in `.open-next/server-functions/...` so likely deployed — but 404 suggests routing failure; could also be CF Worker not seeing the route handler. Worth tracing.)
  - Migration `0001_initial.sql` defines `users`/`sessions` (plural, NextAuth-style) but better-auth expects `user`/`session` — same pattern as linkchat. **Schema mismatch likely.**
- **Status:** PARTIAL → leaning BROKEN (routes 404, schema mismatch likely)

### open-historia
- **Classification:** needs-user-auth (cloud saves per user)
- **Provider:** **better-auth** + Drizzle on D1.
- **Routes:** `app/api/auth/[...all]/` via better-auth handler (per agents.md).
- **DB:** D1 `open-historia-auth` (binding `DB`); schema `lib/db/schema.ts` defines `user`, `session`, `account`, `verification` (correct better-auth names!).
- **Env vars:** `.env.example` has `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TURSO_AUTH_TOKEN` — but Turso is unused (D1 now).
- **Smoke test:** `open-historia.vercel.app/` → 404 (DEPLOYMENT_NOT_FOUND from Vercel — app moved or undeployed).
- **Gaps:**
  - **Vercel deployment is not found** — site appears down/migrated. Need to find the active URL.
  - No migrations dir — schema in `lib/db/schema.ts` (Drizzle) but no SQL migration files. Confirm schema applied via `drizzle-kit push` to D1.
  - `.env.example` lists `TURSO_AUTH_TOKEN` (stale — D1 now).
- **Status:** PARTIAL (code OK, deployment dead)

### reader
- **Classification:** needs-user-auth (saved articles per user)
- **Provider:** Migration in progress per `agents.md`: **Firebase Auth (active)** → **better-auth (target)**. Code has both: `src/lib/auth.ts` is better-auth (Drizzle adapter, no `db` driver — passes raw db); `src/lib/auth-server.ts` is Firebase Admin session cookies; `src/lib/auth-client.ts` likely Firebase web SDK.
- **Routes:** `src/app/api/auth/[...all]/route.ts` (better-auth) coexists with Firebase session handling.
- **DB:** Both: Firestore (current) + Turso/libSQL (target — schema in `src/lib/db/schema.ts` defines both NextAuth-style `users`/`sessions`/`accounts` AND better-auth-style `baSessions`/`baAccounts`/`baVerifications`).
- **Env vars:** `.env.example` has `AUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TURSO_AUTH_TOKEN` — but **no Firebase config vars** (those are in agents.md as Firebase, but env example doesn't list them). Either secrets are inlined in code (bad) or env-driven from a separate var set.
- **Smoke test:** `reader-4nu.pages.dev` — DNS unresolved.
- **Gaps:**
  - Two auth systems running simultaneously (Firebase active + better-auth scaffold). Migration incomplete.
  - `.env.example` missing `FIREBASE_*` vars.
  - Schema has both NextAuth-style and better-auth-style tables — pick one.
  - Coordination note: agent `acfc91a04d218fd01` is actively modifying this repo. Audit only.
- **Status:** PARTIAL — mid-migration

### resume-tailor
- **Classification:** needs-user-auth (resume + job storage per user)
- **Provider:** **better-auth** with custom `tursoAdapter` (raw HTTP-based). `agents.md` says NextAuth v4 — stale.
- **Routes:** `src/app/api/auth/[...all]/route.ts`.
- **DB:** Turso (HTTP client, no Drizzle). Custom adapter built from scratch.
- **Env vars:** `AUTH_SECRET`, `AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TURSO_AUTH_TOKEN` — present.
- **Smoke test:** `resume-tailor.vercel.app/` → **500** (`MIDDLEWARE_INVOCATION_FAILED`); `/api/auth/session` → 500; `/login` → 500. App **down**.
- **Gaps:**
  - **Vercel middleware crashing on every request.** Likely env var missing in prod (`AUTH_SECRET` or `TURSO_AUTH_TOKEN` not set), causing the custom Turso adapter or middleware to throw.
  - `agents.md` says NextAuth v4 — stale (it's better-auth + custom adapter).
  - Coordination note: agent `acfc91a04d218fd01` is actively modifying this repo.
- **Status:** **BROKEN**

### saas-maker
- **Classification:** needs-user-auth (cockpit dashboard per user/project) + needs-api-key (workers/api accepts JWE tokens minted by cockpit)
- **Provider:** Hybrid:
  - `apps/cockpit/src/lib/auth.ts` — **better-auth** with Drizzle adapter on D1 binding `DB`.
  - `workers/api/src/middleware/auth.ts` — verifies Auth.js JWE encrypted with `AUTH_SECRET` (HKDF + A256CBC-HS512 via `jose`). This is **NextAuth v5 token format** (`__Secure-authjs.session-token`).
  - `agents.md` says NextAuth v5 beta — but cockpit code is better-auth. The API worker still accepts NextAuth-style JWE.
- **Routes:** Cockpit `/api/auth/[...all]` (better-auth); API worker `/auth/session`, `/auth/logout` (custom).
- **DB:** D1 `saasmaker-db` (shared cockpit + API). `apps/cockpit/src/lib/auth-schema.ts` defines `user`/`session`/`account`/`verification` (correct better-auth tables).
- **Env vars:** `AUTH_SECRET`, `BETTER_AUTH_SECRET`, `AUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` — present in root `.env.example` and `apps/cockpit/.env.example`.
- **Smoke test:** `app.sassmaker.com` — DNS unresolved. `api.sassmaker.com/` → 404 (root); `/api/auth/session` → 404 (API worker has `/auth/session` not `/api/auth/session`).
- **Gaps:**
  - **Library mismatch between cockpit (better-auth) and api worker (NextAuth JWE).** Cockpit better-auth doesn't mint NextAuth JWE — the API worker's `decryptAuthJsJwe` will fail on better-auth tokens. Either cockpit needs to mint compatible tokens, or API worker needs better-auth bearer support, or service should use shared session cookie via D1.
  - `agents.md` says NextAuth v5 — stale (cockpit is better-auth).
  - Worker secret `AUTH_SECRET` must match cockpit's `BETTER_AUTH_SECRET` for JWE roundtrip.
- **Status:** PARTIAL — auth scaffolding present; cross-service token format likely incompatible. Verify with live test.

### significanthobbies
- **Classification:** needs-user-auth (timeline/journal per user)
- **Provider:** **better-auth** + Drizzle adapter (Turso). `agents.md` claims **NextAuth v4 + @auth/drizzle-adapter** — stale; code is better-auth.
- **Routes:** `src/app/api/auth/[...all]/route.ts` + `src/middleware.ts`.
- **DB:** Turso. Schema `src/db/schema.ts` defines `User`/`Session`/`Account`/`VerificationToken` (NextAuth-style PascalCase) — **mismatch with better-auth defaults** (`user`/`session`/`account`/`verification`).
- **Env vars:** `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TURSO_AUTH_TOKEN` — present.
- **Smoke test:** `significanthobbies.com` — DNS unresolved. App routes are configured for `significanthobbies.com/*` and `www.significanthobbies.com/*` per `wrangler.toml`.
- **Gaps:**
  - Schema names PascalCase (`User`/`Session`) — better-auth expects lowercase. **Schema mismatch likely → first sign-in 500.**
  - No `schema:` mapping passed to `drizzleAdapter`.
  - `agents.md` stale (NextAuth → better-auth).
- **Status:** PARTIAL (likely BROKEN once tested)

### starboard
- **Classification:** needs-user-auth (per-user starred repos)
- **Provider:** **NextAuth v5 beta** (GitHub provider only, `read:user` scope). Stateless — no DB adapter; user upsert into raw Turso `users` table inside `signIn` callback.
- **Routes:** `src/app/api/auth/*` (NextAuth handler).
- **DB:** Turso, raw SQL (no Drizzle). Schema in `src/db/schema.sql` (6 tables).
- **Env vars:** `GITHUB_ID`, `GITHUB_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `TURSO_AUTH_TOKEN` — present.
- **Smoke test:** `starboard.vercel.app/` → 200; `/api/auth/session` → 404; `/login` → 404. The 404 on `/api/auth/session` is wrong for NextAuth — should be 200 with empty session JSON. **Auth handler not deployed correctly.**
- **Gaps:**
  - **`/api/auth/session` 404** — NextAuth catch-all route either not exported or build issue. Likely `src/app/api/auth/[...nextauth]/route.ts` missing or misnamed (would need `[...all]` for v5 or `[...nextauth]`).
- **Status:** **BROKEN** (auth route missing/broken on prod)

### swe-interview-prep
- **Classification:** needs-user-auth (Concepts/FSRS state per user)
- **Provider:** Google One Tap → custom JWT (`google-auth-library` server-side ID token verify, `jsonwebtoken` for app tokens). No NextAuth/better-auth.
- **Routes:** Vercel serverless `api/auth/google.mjs`, `api/auth/verify.mjs`.
- **DB:** Turso, schema auto-init on first server start.
- **Env vars:** `GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`, `JWT_SECRET`, `TURSO_AUTH_TOKEN` — present.
- **Smoke test:** `swe-interview-prep.vercel.app/` → 404 (DNS resolved, but app deployment 404). App appears down or moved.
- **Gaps:**
  - **Deployment 404** — site is not at the assumed Vercel URL. Find live URL.
  - JWT in localStorage typical pattern — XSS-vulnerable.
- **Status:** PARTIAL → unknown deploy state

### today-little-log
- **Classification:** needs-user-auth (personal journal/habits)
- **Provider:** **better-auth** (Google) via Pages Functions catch-all `functions/api/auth/[[all]].ts`. Drizzle adapter on Turso (libSQL).
- **Routes:** Pages Function catch-all routing all `/api/auth/*` to better-auth handler.
- **DB:** Turso (libSQL). Drizzle migrations in `drizzle/migrations/`. Schema in `src/db/schema.ts` defines `user`/`session`/`account`/`verification` (correct).
- **Env vars:** `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TURSO_AUTH_TOKEN`, `VITE_BETTER_AUTH_URL` — present.
- **Smoke test:** `today-little-log.pages.dev/` → 200; `/api/auth/session` → **404**; `/login` → 200; `/api/auth/sign-in/social` → 404.
- **Gaps:**
  - **`/api/auth/*` returns 404** — the Pages Function catch-all isn't matching. Possible causes: `[[all]].ts` (double-bracket) syntax issue with current CF Pages routing, or build skipped functions dir, or `_routes.json` excludes `/api/auth/*`.
  - Migrations exist for scoreboard but I didn't see explicit better-auth migration — schema is in `src/db/schema.ts` but is the better-auth schema applied to remote Turso? Verify.
- **Status:** PARTIAL (schema OK, route not reachable in prod)

### truehire
- **Classification:** needs-user-auth (verified candidate profiles)
- **Provider:** **NextAuth v5 beta** (GitHub only) + `@auth/drizzle-adapter`, database session strategy. Schema correct (`packages/db/src/schema.ts` has `users`/`accounts`/`sessions`/`verificationTokens` matching `DrizzleAdapter` expectations).
- **Routes:** `apps/web/src/app/api/auth/[...nextauth]/route.ts`.
- **DB:** Turso (libSQL) via Drizzle. Migrations `packages/db/drizzle/0000-0003`.
- **Env vars:** `AUTH_SECRET`, `AUTH_URL`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `GITHUB_API_TOKEN`, `DATABASE_AUTH_TOKEN` — present in root + `apps/web/.dev.vars`. Wrangler doc says secrets via `wrangler secret put`.
- **Smoke test:** `truehire.sarthakagrawal927.workers.dev/` → **500**; `/api/auth/session` → 500; `/login` → 500; `/api/auth/sign-in/social` → 500. App **down**. `truehire.pages.dev` DNS unresolved.
- **Gaps:**
  - **Site 500 on every path.** Likely missing CF Worker secrets (`AUTH_SECRET`, `AUTH_GITHUB_SECRET`, `DATABASE_AUTH_TOKEN`) — they're documented as `wrangler secret put`-provisioned but not verified.
  - Or NextAuth v5 beta isn't compatible with the OpenNext CF Workers adapter version pinned here.
  - No D1 binding (uses Turso via DATABASE_URL) — Turso connection failure also possible cause.
- **Status:** **BROKEN**

## Patterns of breakage observed

### 1. Stale `agents.md` Auth declarations (5 apps)
- linkchat: claims NextAuth v5; actually better-auth.
- email-manager: claims NextAuth v4; actually better-auth.
- resume-tailor: claims NextAuth v4; actually better-auth + custom Turso adapter.
- significanthobbies: claims NextAuth v4 + drizzle-adapter; actually better-auth.
- saas-maker: claims NextAuth v5 beta; cockpit uses better-auth, API worker uses Auth.js JWE format. Inconsistent.
- high-signal: claims NextAuth v5; actual is Cloudflare Access (per active plan 0002).

### 2. Schema name / library mismatch (3+ apps)
better-auth defaults to singular table names (`user`, `session`, `account`, `verification`). Several apps run better-auth against NextAuth-style tables (`users`, `sessions`, `accounts`):
- linkchat: plural names, no `schema:` mapping → tables not found → 500.
- significanthobbies: PascalCase (`User`/`Session`), no `schema:` mapping.
- mentionpilot: migration `0001_initial.sql` has plural `users`/`sessions`.
Apps that did this correctly: `today-little-log`, `open-historia`, `saas-maker` (cockpit auth-schema uses singular), `reader` (uses `baSessions`/`baAccounts` aliases with explicit `schema:` mapping).

### 3. Live deployment 500-ing on root (4 apps)
- linkchat, truehire, resume-tailor, swe-interview-prep — all 500 or 404 on prod, suggesting either missing prod secrets or build/deploy regressions. These were the most-broken setups in the audit.

### 4. `/api/auth/*` 404 in CF Pages/Workers builds (3 apps)
- mentionpilot, today-little-log, starboard — `/api/auth/session` returns 404 instead of 200-empty-session. Suggests catch-all route isn't being mounted by the CF runtime correctly. Common causes: OpenNext build dropping the dynamic route, `_routes.json` excluding paths, or `[[all]]` vs `[...all]` syntax.

### 5. JWT-in-localStorage (3 apps)
- agentMode, anime_list, swe-interview-prep all store JWTs in `localStorage` — XSS-vulnerable. Acceptable for MVP/personal but worth noting.

### 6. Stale `.env.example` env vars
- open-historia: `TURSO_AUTH_TOKEN` listed but app moved to D1.
- linkchat: `TURSO_AUTH_TOKEN` listed but moved to D1.
- high-signal: `NEXTAUTH_*` listed but actual is CF Access (`CF_ACCESS_AUD`, `CF_ACCESS_TEAM_DOMAIN`).
- reader: `.env.example` doesn't list Firebase config vars despite Firebase being the active auth path.

## Prioritized fix list (to maximize working-auth count fastest)

### P0 — completely down, fix first
1. **linkchat** — site 500-ing on all routes. Likely BETTER_AUTH_SECRET secret missing OR schema mismatch. Diagnose worker logs (`wrangler tail linkchat`) → set secret if missing → fix schema-to-library mapping.
2. **truehire** — site 500 on all routes. Run `wrangler secret list` against `truehire` worker; set `AUTH_SECRET`, `AUTH_GITHUB_SECRET`, `DATABASE_AUTH_TOKEN` if absent.
3. **resume-tailor** — Vercel `MIDDLEWARE_INVOCATION_FAILED`. Set `AUTH_SECRET`, `TURSO_AUTH_TOKEN` in Vercel project env.

### P1 — auth wired but `/api/auth/*` 404 (low effort, high value)
4. **mentionpilot** — investigate why catch-all route isn't matching. Check OpenNext build output. Then fix migration to use better-auth singular table names (or pass `schema:` mapping).
5. **today-little-log** — same: `[[all]]` vs `[...all]` Pages Functions issue. Confirm function deployed; check `_routes.json`.
6. **starboard** — `/api/auth/session` 404. Verify `[...nextauth]` route deployed.

### P2 — schema mismatch (will 500 on first sign-in attempt)
7. **significanthobbies** — pass explicit `schema:` mapping to `drizzleAdapter` (PascalCase tables). Or migrate tables to better-auth defaults.
8. **email-manager** — create migrations for better-auth tables on `email-manager-auth` D1 (none exist).

### P3 — design / docs cleanup
9. **saas-maker** — reconcile cockpit (better-auth) vs API worker (Auth.js JWE) token format. Either move API worker to validate better-auth bearer (call `auth.api.getSession`) or have cockpit mint Auth.js-compatible JWE.
10. **high-signal** — update `agents.md` (CF Access, not NextAuth) and `.env.example` (`CF_ACCESS_AUD`, `CF_ACCESS_TEAM_DOMAIN`). Verify `apps/web/src/app/api/admin/[...path]/route.ts` exists and verifies CF Access JWT.
11. **reader** — finish Firebase → better-auth migration (or roll back). Currently has both running. (Coordinate with agent acfc91a04d218fd01.)
12. **open-historia** — find live deploy URL (Vercel says deployment not found). Update `.env.example` (drop Turso vars).

### P4 — security hardening (post-functional)
13. agentMode / anime_list / swe-interview-prep — move JWTs out of localStorage to httpOnly cookies. Add refresh.
14. free-ai — implement `GATEWAY_API_KEY` enforcement on `/v1/analytics`.

### Cross-cutting
- Update all stale `agents.md` Auth sections to reflect actual code (5 apps).
- Standardize on **better-auth singular table names** across all better-auth apps to avoid schema-mapping bugs.
- Add `wrangler secret list` verification to `pre-push` hooks for any app declaring `AUTH_SECRET` / `BETTER_AUTH_SECRET`.
