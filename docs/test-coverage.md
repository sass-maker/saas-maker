# Test Coverage Policy

> **Tier:** EXEMPLARY — coverage is measured, enforced in CI, and ratcheted upward over time.

This document explains the coverage strategy for the saas-maker monorepo: the
EXEMPLARY tier goals, current baseline levels, the ratchet strategy used to
enforce coverage without blocking the team, per-package targets, how to run
coverage locally, and how CI enforces it.

## EXEMPLARY tier goals

The EXEMPLARY tier is the highest quality bar in the fleet testing standard.
A project at this tier:

1. **Measures** coverage on every push and pull request.
2. **Enforces** coverage thresholds in CI — a drop in coverage fails the build.
3. **Ratchets** thresholds upward over time so coverage can only improve.
4. **Documents** the policy, baselines, and targets in a single canonical place
   (this file).
5. **Gates local pushes** via a pre-push hook that runs typecheck and unit
   tests, so regressions are caught before they reach CI.

The end-state target is **80%+ across all metrics** (lines, functions, branches,
statements) for the core packages, with higher bars for libraries that other
packages depend on.

## Current coverage levels (baseline)

Measured on the full unit suite (351 tests across 37 files) with
`vitest run --coverage`:

| Metric      | Covered | Total | Percentage |
| ----------- | ------- | ----- | ---------- |
| Statements  | 877     | 2424  | 36.17%     |
| Branches    | 512     | 1750  | 29.25%     |
| Functions   | 107     | 353   | 30.31%     |
| Lines       | 809     | 2054  | 39.38%     |

Coverage is currently scoped to the highest-value surfaces:
`workers/api/src/**/*.ts` and `packages/blocks/src/**/*.ts`. Configuration files,
type definitions, barrel `index.ts` files, and test files themselves are
excluded (see `vitest.config.ts`).

## Ratchet strategy

Setting thresholds to the final 80% target immediately would fail CI, since
current coverage is ~39%. Instead we use a **ratchet**: thresholds are set just
above the current measured levels so that:

- Coverage can never silently drop — any regression fails the build.
- Coverage can grow incrementally — each improvement is captured by raising the
  threshold to the new level + a small margin.
- The team is never blocked by an aspirational bar that does not reflect the
  current state of the codebase.

### Current ratchet thresholds

Configured in `vitest.config.ts`:

| Metric      | Threshold | Baseline | Margin |
| ----------- | --------- | -------- | ------ |
| Lines       | 39%       | 39.38%   | floor  |
| Functions   | 30%       | 30.31%   | floor  |
| Branches    | 29%       | 29.25%   | floor  |
| Statements  | 36%       | 36.17%   | floor  |

Thresholds are set to the **floor** of the current measured coverage so that CI
passes today but any drop — even a fraction of a percent — fails the build. As
coverage grows, raise each threshold to the new floor (rounded down to the
nearest whole percent) plus a small buffer.

### How to raise the ratchet

1. Run `pnpm test:coverage` locally.
2. If coverage has grown beyond the current threshold, open
   `vitest.config.ts` and raise the relevant threshold to the new level + ~3%
   (keep a small buffer so day-to-day variance does not cause flaky failures).
3. Update the table above and the baseline numbers if they have shifted
   meaningfully.
4. Commit the threshold bump alongside the tests that drove the improvement.

Rule of thumb: **never lower a threshold**. If coverage genuinely needs to drop
(e.g. a large untested module was added intentionally), document the reason in
the commit message and lower only the affected metric, with a follow-up task to
restore it.

## Per-package coverage targets

Different packages carry different risk profiles. Libraries consumed by other
packages and external users carry a higher bar than application shells whose
behavior is covered by e2e and integration tests.

| Package                 | Path                       | Target | Rationale                                            |
| ----------------------- | -------------------------- | ------ | ---------------------------------------------------- |
| API (Hono Worker)       | `workers/api/`             | >80%   | Core backend; every route is a contract surface.     |
| CLI                     | `packages/cli/`            | >80%   | User-facing binary; command parsing must be solid.   |
| SDK                     | `packages/sdk/`            | >85%   | Consumed by external users; regressions ship to npm. |
| Blocks (headless logic) | `packages/blocks/`         | >80%   | Shared backend logic reused across packages.         |
| Cockpit (Next.js app)   | `apps/cockpit/`            | >60%   | UI surface; e2e + integration cover the rest.        |
| Widgets                 | `packages/widgets/`        | >70%   | Embedded in third-party sites; must be stable.       |

These are **targets**, not current enforced thresholds. The enforced global
thresholds in `vitest.config.ts` apply to the union of `workers/api/src` and
`packages/blocks/src`. As per-package coverage approaches its target, add
per-package threshold blocks (Vitest supports per-glob thresholds) so each
package is gated independently.

## How to run coverage locally

```bash
# Full unit suite with coverage (same command CI uses)
pnpm test:coverage

# Coverage report is written to coverage/
# - coverage/coverage-summary.json  (machine-readable summary)
# - coverage/                       (v8 raw + text-summary reporters)

# Unit tests without coverage (faster feedback loop)
pnpm test

# Integration tests (require SAASMAKER_API_KEY, hit live API — NOT in CI)
pnpm test:integration

# Playwright e2e (require SAASMAKER_E2E_CLI_TOKEN, hit live API — gated in CI)
pnpm test:e2e
```

To inspect a richer HTML report locally, temporarily add `'html'` to the
`reporter` array in `vitest.config.ts` and open `coverage/index.html`. Do not
commit the `html` reporter — it bloats the CI artifact.

## CI coverage enforcement

Coverage is enforced in `.github/workflows/ci.yml`:

1. The `build-and-test` job runs `pnpm test:coverage` instead of `pnpm test`.
   Vitest checks the configured thresholds and fails the job if any metric
   falls below its ratchet value.
2. The `coverage/` directory is uploaded as a CI artifact
   (`coverage-report`, 7-day retention) using `actions/upload-artifact@v4`
   with `if: always()` so the report is available even when tests fail.
3. E2E tests run in a separate `e2e` job that is gated to pushes on `main`
   only (not pull requests), uses the `SAASMAKER_E2E_CLI_TOKEN` secret, and
   uses `continue-on-error: true` so a production-availability hiccup does
   not block the pipeline.
4. Integration tests remain opt-in and are not run in CI (they require a live
   API key and hit production).

## Local pre-push gate

The `.husky/pre-push` hook runs, in order:

1. **Lint** — `pnpm lint` (if a `lint` script exists).
2. **Secret scan** — aborts if known token/key patterns are found in tracked
   files (with allow-lists for tests, fixtures, and examples).
3. **Typecheck** — `pnpm typecheck` (fleet-wide `tsc --noEmit`).
4. **Unit tests** — `pnpm test` (fast feedback before pushing).

This mirrors the CI gate locally so regressions are caught before they reach
the remote. To bypass in an emergency, use `HUSKY=0 git push` — but record a
follow-up task to fix whatever was failing.
