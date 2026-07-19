# STATUS

> Short living snapshot. For the durable ledger (why/what, dependencies,
> full timeline, shipped features, long-form todo/deferred/blocked) see
> [`PROJECT_STATUS.md`](./PROJECT_STATUS.md) — that is the canonical history.
> Update this file when the current focus changes; don't duplicate history
> here.

**Last updated:** 2026-07-18

## Current objective

Land a maintainable, local-first documentation knowledge system for
psi-swarm: consolidate scattered docs into one `docs/` tree, add a Blume
presentation layer that renders the existing Markdown, and add validation +
CI so the docs stay trustworthy. Markdown remains the source of truth.

## Active work

- Reorganised `docs/` into product / architecture / development / operations
  / knowledge / current / prds (see [`docs/index.md`](./docs/index.md)).
- Added ADRs for the non-obvious stack decisions (Node 22 pin, local-first,
  pnpm migration, OSS integration).
- Added Blume config (`blume.config.ts`) + `pnpm docs:*` scripts + a docs
  validation script (`scripts/validate-docs.mjs`).
- Added `.github/workflows/docs.yml` CI for docs validation + Blume build.

## Blockers

- _(none currently)_

## Unresolved questions

- **Missing `ci.yml` workflow.** `scripts/manual-deploy.mjs` references
  `ci.yml` as the green-gate for `pnpm deploy`, but no
  `.github/workflows/ci.yml` exists — only `deploy.yml` (manual dispatch)
  and the new `docs.yml`. `pnpm deploy` will fail at the CI-green check
  until a `ci.yml` is added (or `manual-deploy.mjs`'s default is changed).
  See [docs/operations/deploy.md](./docs/operations/deploy.md#known-gap-no-push-triggered-ci).
- **No automated test suite.** The CLI's pure functions
  (`stats.ts`, `presets.ts`, `watchlist.ts` queue sort) are the
  highest-value unit tests to add. See
  [docs/development/testing.md](./docs/development/testing.md).
- **Blume not yet installed locally.** `blume` is added as a root
  devDependency; run `pnpm install` to materialise it, then `pnpm docs:dev`
  / `pnpm docs:build` to preview. The config is in place but the build has
  not been run end-to-end in this pass.

## Next steps

1. Run `pnpm install` to install Blume, then `pnpm docs:build` to verify
   the docs site builds.
2. Decide on `ci.yml`: add a real CI workflow (docs check + CLI/web builds)
   or repoint `manual-deploy.mjs` at an existing workflow.
3. Add unit tests for `cli/src/stats.ts` and `cli/src/presets.ts`
   (`node --test`, no new dependency).
4. Validate an external trace-insight adapter (Chrome DevTools MCP) against
   a small set of known regressions — carried over from
   [`PROJECT_STATUS.md`](./PROJECT_STATUS.md#planned-next).
