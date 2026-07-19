---
title: Testing
description: The current test/quality situation — no automated test suite yet.
---

# Testing

_Unresolved:_ there is **no automated test suite** in this repo today.

## Current state

- The root `package.json` has no `test` or `lint` script.
- The `cli` package has no test script; its build is `tsc` (type-check by
  side effect).
- The `web` package has no test script; its build is `astro build`.
- There is no CI workflow that runs tests on push — the only workflows are
  `.github/workflows/deploy.yml` (manual dispatch) and
  `.github/workflows/docs.yml` (docs paths only). See
  [operations → deploy](../operations/deploy.md).

## What stands in for tests

- **Type-check by build.** `pnpm run build:cli` and `pnpm run build:web`
  catch type regressions.
- **Docs validation.** `pnpm docs:check` validates frontmatter and internal
  links (see [workflow](./workflow.md)).
- **Smoke checks in deploy CI.** The deploy workflow curls `/` and
  `/projects/` against the production URL after a Pages deploy.
- **Manual runs.** The product is a measurement tool; correctness is
  validated by running swarms against known URLs and reading the percentile
  tables.

## Why no suite yet

The codebase is small (~5.5k LOC in `cli/src`) and the core math
(percentile interpolation in `cli/src/stats.ts`, preset resolution in
`cli/src/presets.ts`) is the highest-value thing to unit-test. This is
recorded as a follow-up, not a decision to skip — see
[STATUS.md](../../STATUS.md).

## If you add tests

- Put a `test` script on the package that owns the code (`cli` or `web`),
  not the root.
- Prefer `node --test` (built-in, no dependency) for the CLI's pure
  functions (`stats.ts`, `presets.ts`, `watchlist.ts` queue sort).
- Add a `ci.yml` workflow that runs the suite on push — note that
  `scripts/manual-deploy.mjs` already references `ci.yml` as the
  green-gate, but **no `ci.yml` exists yet** (see
  [operations → deploy](../operations/deploy.md#known-gap-no-push-triggered-ci)).
