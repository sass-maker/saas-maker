---
name: fleet-health
description: Run a bulk health check across all active fleet projects — git status, CI signal, deploy readiness. Use when the user asks "is the fleet healthy?", "check all projects", "what's broken?", or wants a fleet-wide status snapshot before a deploy or audit.
---

# fleet-health — bulk fleet health check

Runs git health, CI status, and deploy readiness across all 25 active fleet
projects in one pass. Reports a compact table of what's clean, what's dirty,
and what's broken.

## When to invoke

- "Is the fleet healthy?"
- "Check all projects"
- "What's broken right now?"
- "Can I deploy everything?"
- Before any fleet-wide audit or sweep

## How to invoke

```bash
bash ~/Desktop/fleet/fleet-ops/scripts/fleet-health.sh
```

Or per-project:

```bash
bash ~/Desktop/fleet/fleet-ops/scripts/git-health.sh   # from a project dir
bash ~/Desktop/fleet/fleet-ops/scripts/deploy-health.sh # from a project dir
```

## What it checks

For each active project (from the README product list):

1. **Git state** — clean main? uncommitted changes? ahead/behind remote?
2. **CI signal** — latest GitHub Actions run on main: green/red/unknown
3. **Branch** — on main or a feature branch?

## Output

A compact table:

```
PROJECT          BRANCH  GIT    CI     NOTES
saas-maker       main    clean  green  —
ai-game          main    dirty  green  2 uncommitted files
anime-list       main    clean  red    ci.yml failing
...
```

Then a summary: N clean, N dirty, N CI-red, N unknown.

## What to do with results

- **CI-red projects** — investigate the failing workflow, fix or track as a task
- **Dirty projects** — commit or stash before any fleet operation
- **Not on main** — flag if a deploy is planned
