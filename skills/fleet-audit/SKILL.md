---
name: fleet-audit
description: Run and interpret the SaaS Maker/Foundry fleet audit across local repos, GitHub PRs/actions, Cloudflare/prod smoke checks, and local build/test health; use when asked to audit the fleet, check project health, prepare recurring fleet reports, or triage fleet regressions.
metadata:
  short-description: Audit the Foundry project fleet
---

# Fleet Audit

Use this skill for recurring or ad hoc audits of the Foundry fleet in `/Users/sarthak/Desktop/fleet`.

## Default Command

Run from the `saas-maker` repo:

```bash
pnpm fleet:audit
```

The command writes:

- `.symphony/fleet-audit/latest.md`
- `.symphony/fleet-audit/latest.json`

For a faster non-local pass:

```bash
pnpm fleet:audit -- --skip-local
```

For the recurring full audit, including frontend performance checks:

```bash
pnpm fleet:audit -- --performance --lighthouse
```

For one project:

```bash
pnpm fleet:audit -- --project <slug>
```

## How To Interpret

- `ok`: no open PRs, failed latest main workflows, failed prod smoke checks, local dirty state, or local check failures.
- `watch`: usually open PRs or performance budget warnings; do not create urgent tasks unless stale, regressed from baseline, or user asks.
- `fail`: real regression candidate; read details before creating tasks.

Expected non-issues:

- `api.sassmaker.com/` root may be `404`.
- `mal-api...workers.dev/` root may be `404`.
- `saas-maker` can be dirty during active local setup work; report it, but do not revert or clean without user approval.
- First-run performance budget warnings are baselines for review, not automatic regressions.

## Audit Workflow

1. Run `pnpm fleet:audit` unless the user asks for a quick pass.
2. Read `.symphony/fleet-audit/latest.md`.
3. Summarize:
   - open PRs
   - failed latest main workflows
   - failed prod smoke checks
   - local build/test failures
   - performance hard failures and budget warnings
   - dirty repos that need attention
4. If the report has task suggestions, propose or create Symphony tasks only for real regressions.
5. Do not auto-merge PRs, deploy, delete Cloudflare projects, rotate secrets, or clean dirty worktrees unless the user explicitly asks.

## Task Creation Rules

Create or update Symphony tasks for:

- latest main workflow failures
- failed production smoke checks
- local build/test/typecheck failures
- broken deploy pipeline

Do not create tasks for:

- known open PRs unless stale or blocking
- expected API-root `404`s
- local dirty state in `saas-maker` during active work
- missing local OAuth credentials when builds pass

## Output Style

Keep the final report compact:

- lead with overall status
- list real regressions first
- list watch items separately
- include links for PRs/actions when available
- include the report path
