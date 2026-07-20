# Operations

How SaaS Maker and the fleet are run, verified, and recovered. For the
executable scripts, see [`scripts/`](https://github.com/sass-maker/saas-maker/tree/main/scripts) — these docs are the
human-readable companion.

## Files

- [`cloudflare-secret-management.md`](cloudflare-secret-management.md) —
  fleet-level Cloudflare secret audit. `cloudflare.targets.json` is the source
  of truth for target names, required secrets, vars, and bindings.
- [`cf-shields-state.md`](cf-shields-state.md) — Cloudflare cost/abuse shields
  applied across the fleet (observability, CPU limits, rate-limit bindings).
- [`baseline-2026-04-27.md`](baseline-2026-04-27.md) — pre-Workers-Paid
  snapshot of fleet Workers traffic and cost baseline.
- [`migration-plan.md`](migration-plan.md) — per-project migration plan for
  Cloudflare Workers Paid primitives (Hyperdrive, Vectorize, Email Workers,
  Browser Rendering, etc.).
- [`stale-artifact-review.md`](stale-artifact-review.md) — fleet-wide stale
  artifact sweep findings requiring human review.
- [`posthog-fleet-dashboards.md`](posthog-fleet-dashboards.md) — the canonical
  `project_id` HogQL coalesce filter for fleet-shared PostHog dashboards.
- [`foundry-migration-ledger.md`](foundry-migration-ledger.md) — exact source
  revisions, import boundaries, production identities, and rollback references
  for the Foundry monorepo consolidation.
- [`performance-observability.md`](performance-observability.md) — canonical
  provider-neutral web/API speed evidence, privacy, retention, and activation
  contract.
- [`always-on-automation-setup.md`](always-on-automation-setup.md) — bootstrap
  a Mac to run the codex-automations cron jobs against the fleet checkout.
- [`launch-kit.md`](launch-kit.md) — ready-to-post distribution copy and the
  EOY domain-rating (DR) plan for owned domains.
- [`laptop-service-backup-2026-05-31.md`](laptop-service-backup-2026-05-31.md) —
  laptop service backup notes.

## Subdirectories

- [`jobs/`](jobs/README.md) — catalog of scheduled jobs (`codex-automations/`).
- [`runbooks/`](runbooks/README.md) — step-by-step runbooks for audits, smoke, and
  recovery.

## Key operational commands

| Command | Purpose |
| --- | --- |
| `pnpm smoke` | Post-deploy prod smoke (7 HTTP checks). |
| `pnpm fleet:prod-smoke` | Fleet-wide production smoke. |
| `pnpm fleet:audit` | Full fleet audit (local + GitHub + smoke). |
| `pnpm fleet:secret-audit` | Cloudflare secret/vars/bindings audit. |
| `pnpm fleet:monitoring-audit` | Monitoring coverage audit. |
| `pnpm fleet:posthog-verify` | PostHog `project_id` coalesce verification. |
| `pnpm catalog:generate` | Generate performance surfaces and the other canonical catalog views. |
| `pnpm check:fleet-contracts` | Registry vs docs vs `PROJECT_STATUS.md` sync. |
