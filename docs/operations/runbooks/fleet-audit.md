# Runbook: Fleet Audit

Run a full fleet audit from the SaaS Maker repo. This is what the
`weekly-fleet-ops-audit` cron job runs every Monday.

## Prerequisites

- `pnpm install` completed in `/Users/sarthak/Desktop/fleet/saas-maker`.
- `fnd login` run on this machine (for Symphony task write-back).
- `gh auth login` run (for GitHub Actions failure checks).
- PostHog/Cloudflare only needed if you want those checks; never print secrets.

## Steps

### 1. Sync the task board (avoid duplicates)

```bash
pnpm symphony --json --no-cache
```

Read the output before creating any task. Update/comment existing tasks before
creating new ones.

### 2. Full fleet audit with performance + Lighthouse

```bash
pnpm fleet:audit -- --performance --lighthouse
```

Read `.symphony/fleet-audit/latest.md` and `latest.json`. Flag if the run was
not full-fleet.

### 3. Production smoke with screenshots

```bash
pnpm fleet:prod-smoke -- --timeout-ms 45000 --screenshot-all
```

Read the latest artifacts under `.symphony/fleet-production-smoke/`. Flag any
project-scoped or stale results clearly; do not treat them as product
regressions.

### 4. Monitoring coverage audit

```bash
pnpm fleet:monitoring-audit -- --fail-on-missing
```

### 5. Check default-branch GitHub failures

```bash
gh run list --workflow=ci.yml --branch=main --limit=5 --json ...
```

(Or use `scripts/fleet-failure-import.mjs` to convert failures into Symphony
tasks — see [`../../architecture/symphony.md`](../../architecture/symphony.md)
"Fleet failure importer".)

## Triage rules

- Create tasks only for **real regressions**: latest workflow failure, failed
  deploy pipeline, failed smoke, broken auth, missing required monitoring, or
  shipped-behavior blocker.
- Mark approval/config/access/deploy tasks `blocked_on_user=true`.
- Dispatch safe independent remediation to agents only when acceptance is clear
  and no protected action is needed.

## Output

Concise: regressions, watch items, tasks changed, agents used, checks, what
needs Sarthak. No raw logs.
