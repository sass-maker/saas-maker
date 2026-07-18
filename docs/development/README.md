# Development

Development workflows, testing, and quality gates. For repo setup and commands,
see [`../../AGENTS.md`](../../AGENTS.md) (the agent bootloader) and
[`../../CONTRIBUTING.md`](../../CONTRIBUTING.md).

## Files

- [`quality-gates.md`](quality-gates.md) — the two-layer gate strategy
  (pre-push + post-deploy smoke) that stops runtime regressions from reaching
  prod.
- [`testing-backlog.md`](testing-backlog.md) — single source of truth for what
  is NOT covered yet. Update on every push that lands tests or surfaces a
  regression. Triage rule: only test what has burned us before or what is on
  the daily critical path.

## Required workflow when API routes change

1. `pnpm generate:openapi` — updates `packages/cli/src/openapi.json`,
   `docs/openapi/openapi.json`, `apps/docs/public/openapi.json`.
2. Update `packages/cli/README.md` and `apps/docs/src/content/docs/sdk/cli.md`
   (and the canonical `docs/sdk/cli.md`).
3. Add a `fnd examples` entry if user-facing.
4. `pnpm check:openapi` to verify the generated artifacts match the routes.

## Pre-push gate

Defined in `.husky/pre-push`: lint → fleet-wide `tsc --noEmit` → vitest → secret
scan. Run `HUSKY=0` only when explicitly bypassing for a documented reason.
