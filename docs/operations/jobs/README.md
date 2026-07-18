# Scheduled Jobs

Catalog of recurring automated jobs that touch SaaS Maker. The executable
schedule is authoritative and lives in code: `codex-automations/*/automation.toml`
(local Codex automations) and `.github/workflows/*.yml` (GitHub Actions). This
file is the human-readable index — update it when a job is added, retired, or
its cadence changes.

## Local Codex automations (`codex-automations/`)

All run locally with `execution_environment = "local"` and read the fleet from
`/Users/sarthak/Desktop/fleet/saas-maker`. None deploy, migrate, push, or touch
secrets — they are read-mostly or create tasks/ideas only.

| ID | Name | Cadence (RRULE) | Model | Purpose |
| --- | --- | --- | --- | --- |
| `daily-fleet-health-sentinel` | Daily Fleet Health Sentinel | Mon–Sun 08:00 | gpt-5.2 / medium | Lightweight daily regression check: prod smoke, monitoring audit, latest CI failures. Create tasks only for real regressions. |
| `weekly-fleet-ops-audit` | Weekly Deep Fleet Ops Audit | Mon 08:00 | gpt-5.2 / high | Full-fleet audit: `fleet:audit --performance --lighthouse`, prod smoke with screenshots, monitoring audit, CI failures. Dispatch safe remediation. |
| `biweekly-fleet-audit` | Weekly Active-AI Product Review | Mon 10:00 | gpt-5.2 / high | Ranked product/design review of P0/P1 lanes; create ≤5 tasks; dispatch independent work via Symphony. |
| `fleet-backlog-router` | Fleet Backlog Router | Tue–Fri 11:00 | gpt-5.2 / high | Pick 4–8 unblocked backlog tasks and dispatch to Symphony agent profiles; coordinate, verify, fix agent mistakes. |
| `marketing-queue-builder` | Marketing Queue Builder | Tue, Thu 15:00 | gpt-5.2 / medium | Create 3–7 AI-video-first marketing ideas in the Marketing Queue via API-first workflow. No posting. |

Notes:

- `daily-fleet-health-sentinel` and `weekly-fleet-ops-audit` overlap on Monday
  morning; the daily sentinel is the quick read, the weekly audit is the deep
  pass with screenshots and remediation dispatch.
- `biweekly-fleet-audit` is named "biweekly" but scheduled weekly — the id is
  historical. Treat the RRULE as the truth.

## GitHub Actions (`.github/workflows/`)

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| `ci.yml` | push/PR to `main` | Build + test, then path-gated deploys of API, cockpit, docs, showcase to Cloudflare. |
| `fleet-production-smoke.yml` | push to `main`, `workflow_dispatch` | Playwright browser smoke against active production frontends. |
| `weekly.yml` | cron `0 9 * * 1`, `workflow_dispatch` | Weekly quality check across the repo. |
| `foundry-cf-deploy.yml` | `workflow_call` | Reusable Cloudflare deploy workflow (pinned via `@v1` by fleet repos). |
| `foundry-ci.yml` | `workflow_call` | Reusable CI workflow consumed by fleet repos. |
| `foundry-weekly.yml` | `workflow_call` | Reusable weekly quality workflow consumed by fleet repos. |
| `docs.yml` | push/PR to `main` (touches `docs/`, `AGENTS.md`, `STATUS.md`, `apps/docs-blume/*`) | `pnpm check:docs` — broken links, empty docs, required files. |

## Adding a scheduled job

1. Local Codex automation: add `codex-automations/<id>/automation.toml` and add
   a row to the table above.
2. GitHub Actions: add `.github/workflows/<name>.yml` and add a row to the
   table above.
3. If the job is fleet-reusable, add it as a reusable workflow and document the
   `@v1` pin convention.
