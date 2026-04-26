# Security & Quality Audit

Conducted: 2026-03-29
Reviewed: 2026-04-26

---

## HIGH Severity

- [x] **Global error handler** — `workers/api/src/index.ts:33` — `app.onError()` now captures unhandled exceptions to PostHog and returns generic 500. _Fixed 2026-04-26._
- [x] **POST /v1/directory — spam protection** — Route removed from active product. _Fixed 2026-04-26._
- [x] **POST /v1/forms/public/:slug/submit — rate limit** — Forms route removed from active product. _Fixed 2026-04-26._
- [x] **POST /v1/testimonials/by-project/:slug — rate limit** — `workers/api/src/routes/testimonials.ts:44` — `d1RateLimitDynamic` (5 / hour / IP). _Fixed 2026-04-26._
- [x] **POST /v1/roadmap/public/:slug/:id/vote — rate limit** — `workers/api/src/routes/roadmap.ts:24,72` — `d1RateLimitDynamic` (20 / hour / IP for vote, 5 for submit). _Fixed 2026-04-26._

## MEDIUM Severity

- [x] **CockroachDB binary in git** — Removed in commit `332c334` (sanitize repo). _Fixed._
- [ ] **FeedbackStatus type too narrow** — `packages/blocks/shared-types/src/index.ts` — DB and routes use up to 8 values; type and `isValidStatus()` still need widening.
- [ ] **Session ID not unique per IP** — `workers/api/src/ua.ts:45` — `computeSessionId()` hashes `date|country|device|browser`. Inflates unique-visitor counts. Add IP-hash component.

## LOW Severity

- [x] **CORS reflects any Origin** — `workers/api/src/index.ts:51-77` — Allowlist now enforced (`isAllowedOrigin`); falls back to `https://app.sassmaker.com`. _Fixed 2026-04-26._
- [ ] **Vector search loads all chunks into memory** — `workers/api/src/db.ts:searchChunks` — Acceptable at current scale; migrate to Vectorize binding when growth warrants.
- [ ] **Rate limit state per-isolate** — `workers/api/src/middleware/rate-limit.ts` — In-memory `Map` for API-key path. D1 shield used for unauth paths. Migrate API-key path to D1 when traffic spread across many isolates.
- [x] **No secrets in git** — Re-verified 2026-04-26. `.dev.vars`, `.env*`, credentials covered by `.gitignore`.

## Open Items (post-Foundry transition)

- [ ] **Split `workers/api/src/db.ts`** (1738 LOC) — Single God file; refactor per domain (feedback / projects / analytics / etc).
- [ ] **Migrate API-key rate limiter to D1 shield** — Distributed isolates currently leak rate-limit windows.
