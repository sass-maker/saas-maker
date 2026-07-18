# Runbooks

Step-by-step runbooks for fleet operations. Each runbook is a focused,
copy-pasteable procedure for a recurring operational task. For the catalog of
scheduled jobs, see [`../jobs/README.md`](../jobs/README.md). For background on
the operational layer, see the files in [`../`](../) (Cloudflare secrets,
shields, baselines, PostHog, launch kit).

## Available runbooks

| Runbook | When to use |
| --- | --- |
| [`fleet-audit.md`](fleet-audit.md) | Run a full fleet audit (`pnpm fleet:audit`). This is what the `weekly-fleet-ops-audit` cron job runs every Monday. |
| [`smoke-prod.md`](smoke-prod.md) | Verify SaaS Maker production surfaces are healthy (`pnpm smoke` / `pnpm fleet:prod-smoke`). Includes post-deploy smoke and fleet-wide smoke. |

## Where the procedures live today

The operations procedures are documented in the parent `docs/operations/` files
and the executable scripts in `scripts/`. Promote a procedure into a standalone
runbook under this directory only when it is long enough to warrant its own
page or is referenced from multiple places.

| Procedure | Source of truth |
| --- | --- |
| Cloudflare secret audit | [`../cloudflare-secret-management.md`](../cloudflare-secret-management.md) + `pnpm fleet:secret-audit` (`scripts/fleet-secret-audit.mjs`) |
| Production smoke | `pnpm smoke` / `pnpm fleet:prod-smoke` (`scripts/smoke-prod.mjs`, `scripts/fleet-production-smoke.mjs`) |
| Fleet audit | `pnpm fleet:audit` (`scripts/fleet-audit.mjs`) |
| Monitoring audit | `pnpm fleet:monitoring-audit` (`scripts/fleet-monitoring-audit.mjs`) |
| PostHog verify | `pnpm fleet:posthog-verify` (`scripts/fleet-posthog-verify.mjs`) |
| OpenAPI regeneration | `pnpm generate:openapi` (`scripts/generate-openapi.mjs`) — required when API routes change |
| Fleet contract sync | `pnpm check:fleet-contracts` (`scripts/check-fleet-contract-sync.mjs`) |
| Local Droid run | `pnpm droid:local` (`scripts/droid-headless-local.mjs`) |
| Symphony dispatch | `pnpm symphony` family (`scripts/symphony-*.mjs`) |
| Domain-rating launch | [`../launch-kit.md`](../launch-kit.md) |

## Pre-push and post-deploy gates

- **Pre-push** (`.husky/pre-push`): lint → fleet-wide `tsc --noEmit` → vitest →
  secret scan. Bypass with `HUSKY=0` only for a documented reason.
- **Post-deploy smoke**: `pnpm -F @saas-maker/api run deploy` and
  `pnpm -F @saas-maker/dashboard run deploy` both run `scripts/smoke-prod.mjs`
  after a successful deploy. Failure = bad release; roll back.

See [`../../development/quality-gates.md`](../../development/quality-gates.md) for the
two-layer gate strategy and [`../../../AUDIT.md`](../../../AUDIT.md) for the security
and quality audit log.
