# Testing Backlog

Single source of truth for what's NOT covered yet. Update on every push that
either lands new tests (mark item ✓) or surfaces a regression that should
have been caught (add a new item with the date).

Triage rule: only test what has either burned us before or is on the daily
critical path. Speculative coverage is yak shaving.

---

## Already Covered

- Pre-push gate: lint → fleet-wide `tsc --noEmit` → vitest (136) → secret scan
- Post-deploy smoke (`scripts/smoke-prod.mjs`): 7 prod HTTP checks, wired
  into both API and cockpit `pnpm run deploy` scripts
- Playwright e2e: `tests/e2e/api/auth-chain.spec.ts` (21 probes) +
  `tests/e2e/api/authed-bridge.spec.ts` (5 probes that mint a real
  better-auth session via `/v1/test/mint-session`)
- Vitest unit:
  - `tests/cli/projects.test.ts` (CRUD)
  - `tests/cli/fleet.test.ts` (list, audit, fix, secrets-sync)
  - `tests/cli/doctor-status.test.ts`
  - `tests/cli/api-command.test.ts`
  - `tests/cli/request-auth.test.ts`
  - `packages/cli/src/commands/__tests__/forge.test.ts`
  - `packages/cli/src/commands/__tests__/init.test.ts`
  - `tests/api/{analytics,feedback-flow,feedback-validation,roadmap,
    waitlist,ua}.test.ts`

---

## HIGH — surfaces that have broken before

- [ ] **`fnd login` polling loop**. Current `loginCommand` calls `fetch`
  + `setTimeout` directly; can't be tested without injecting them. Needs
  refactor: extract `pollForApproval(http, sleep, …)`, then test the
  approve / expired / timeout paths. Today the user couldn't complete
  login because of an unrelated bug; the polling itself was never
  exercised in CI.
- [ ] **Cockpit authed page rendering**. Today every authed-route test
  asserts redirect → `/login`. Real users see the page rendered. The
  `mint-session` helper now exists in `workers/api/src/routes/test.ts`
  + `FOUNDRY_E2E_SECRET`; extend Playwright to:
  1. Mint session via the helper
  2. POST `/api/auth/sign-in/email-mock` (or set the
     `__Secure-better-auth.session_token` cookie directly)
  3. GET `/projects` and assert the user's email + project list render
- [ ] **`workers/api/src/db.ts` implicit-any baseline**. `tsconfig.json`
  has `noImplicitAny: false` to silence ~15 errors there. Each is a
  potential runtime bug. Re-enable strictness and fix the underlying
  call sites — likely needs splitting `db.ts` into per-domain files.
- [ ] **`@saas-maker/ops` d.ts drift**. The hand-rolled
  `packages/blocks/ops/dist/index.d.ts` is the public surface; if a new
  function lands in `src/` and we forget to mirror, downstream packages
  break silently. Add a CI check that runs `tsup` and diffs the
  generated d.ts against the hand-rolled one (or fix the tsup DTS
  baseUrl warning so the generator works again).

## MEDIUM — likely to bite once fleet integration starts

- [ ] **`fnd init` against a fresh non-saas-maker repo**. Today's tests
  mock the filesystem. The first time we point `fnd init` at a real
  fleet repo (anime_list, looptv, etc.) is the first time we'll hit
  the real path. Add a Playwright-style "harness" test that creates a
  scratch dir, runs `fnd init --offline`, asserts files written.
- [ ] **`fnd fleet provision`**. Clones every repo by URL — fails on
  SSH-only remotes, missing `foundry.projects.json` entries, repos
  that already exist. Test against a fixture manifest.
- [ ] **`fnd fleet upgrade`**. Runs `pnpm add -D` everywhere. Will fail
  silently in npm/yarn repos. Pre-flight: detect package manager per
  project, error if not pnpm — or support npm/yarn.
- [ ] **`fnd fleet secrets-sync`**. Writes `.env.local` files. Today's
  test asserts the API call shape only; needs a fixture that proves
  it does NOT clobber existing values, only adds/updates.
- [ ] **Block CRUD CLI**. `feedback`, `roadmap`, `changelog`,
  `testimonials`, `waitlist` only register a `list` action. Verify the
  list output formats and error handling — same shape as `projects`,
  could share a parameterized test.
- [ ] **Cockpit page renders for each authed surface**. Once the
  authed-render harness above lands, parameterize over: `/projects`,
  `/projects/<slug>`, `/projects/<slug>/{feedback,roadmap,
  testimonials,changelog,waitlist,analytics,settings}`, `/secrets`,
  `/tasks`, `/jobs`, `/manifest`, `/fleet`, `/standards`. Assert HTTP
  200 + key element present.
- [ ] **Public roadmap voting flow**. Submit + vote + remove vote +
  rate-limit boundary. End-to-end against prod with a throwaway
  project.
- [ ] **`/v1/standards/<type>` round-trip**. PUT then GET as the same
  user, then call `fnd fleet fix` and assert the merged `eslint.config.js`
  contains the new rules.

## LOW — speculative, only test if regressed

- [ ] `fnd fleet clean` — destructive (rm -rf). Test against a temp dir.
- [ ] `fnd fleet search` — `grep -rnE` orchestration. Easy to break with
  shell quoting.
- [ ] `fnd supervise` daemon — long-running, hard to test deterministically.
- [ ] `fnd fleet apply <skill>` — spawns Gemini child process; environment
  dependent.
- [ ] Showcase / Docs apps — both static; visual regression has more
  signal than route tests.
- [ ] `widgets/*` — embedded JS; a Playwright fixture page that mounts
  each widget against prod API would catch a lot at once.

## Coverage Gaps With Known Workarounds

- **CockroachDB references**: removed in code; `.env.example` now reflects
  D1. No test enforces this; rely on grep + AUDIT.md review.
- **Workspace package-name drift** (`@saas-maker/foundry-email` etc.):
  caught now by typecheck. No additional test needed.
- **OpenAPI spec drift**: `pnpm check:openapi` already exists but isn't
  in the pre-push gate. Add it once routes start changing again.

---

## How To Pick The Next Item

1. Did something break in production this week? → write that test first.
2. Are you about to ship a fleet-integration step? → cover the items
   under MEDIUM "fleet integration starts" before flipping.
3. Got 30 min of slack? → re-enable `noImplicitAny` on workers/api and
   chip away at the resulting errors.

Don't preemptively cover LOW items. They're cheaper to fix when broken
than to test now.
