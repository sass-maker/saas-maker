# Security & Quality Audit

Conducted: 2026-03-29
Reviewed: 2026-04-26 (gate hardening pass)

## Gates

- **Pre-push** (`.husky/pre-push`): lint → typecheck (fleet-wide `tsc --noEmit`) → tests (vitest) → secret scan.
- **Post-deploy smoke** (`scripts/smoke-prod.mjs`): 7 prod checks (API health, CORS, auth rejection, cockpit /login, /projects redirect, sign-in/social returns Google URL, bundled JS does not contain `localhost:8787`). Wired into both `pnpm -F @saas-maker/api run deploy` and `pnpm -F @saas-maker/dashboard run deploy`.
- **CI tag-pinned** (`@v1`): fleet repos consume `sass-maker/saas-maker/.github/workflows/foundry-ci.yml@v1`. Bad commits to saas-maker `main` no longer break the entire fleet's CI; promotion is explicit via `git tag -f v1`.

---

## HIGH Severity

- [x] **Global error handler** — `workers/api/src/index.ts:33` — `app.onError()` now captures unhandled exceptions to PostHog and returns generic 500. _Fixed 2026-04-26._
- [x] **POST /v1/directory — spam protection** — Route removed from active product. _Fixed 2026-04-26._

## MEDIUM Severity

- [x] **CockroachDB binary in git** — Removed in commit `332c334` (sanitize repo). _Fixed._
- [ ] **FeedbackStatus type too narrow** — `internal/contracts/index.ts` and `@saas-maker/sdk` — DB and routes use up to 8 values; public SDK types still need widening.
- [ ] **Session ID not unique per IP** — `workers/api/src/ua.ts:45` — `computeSessionId()` hashes `date|country|device|browser`. Inflates unique-visitor counts. Add IP-hash component.

## LOW Severity

- [x] **CORS reflects any Origin** — `workers/api/src/index.ts:51-77` — Allowlist now enforced (`isAllowedOrigin`); falls back to `https://app.sassmaker.com`. _Fixed 2026-04-26._
- [x] **Vector search in API** — knowledge routes and chunk tables removed 2026-06-20. _Fixed._
- [x] **No secrets in git** — Re-verified 2026-04-26. `.dev.vars`, `.env*`, credentials covered by `.gitignore`.

## Open Items (post-Foundry transition)

- [ ] **Split `workers/api/src/db.ts`** (1738 LOC) — Single God file; refactor per domain (feedback / projects / analytics / etc).
