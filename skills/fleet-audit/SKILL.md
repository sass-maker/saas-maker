---
name: fleet-audit
description: Audit the fleet — git/CI health, PROJECT_STATUS sync, or full recurring audit. Use when the user asks "is the fleet healthy?", "what's the fleet status?", "what's everyone working on?", "audit the fleet", "check all projects", "what's broken?", or wants a fleet-wide snapshot before a deploy or audit pass.
metadata:
  short-description: Audit the Foundry project fleet
---

# Fleet Audit

Three modes, one skill. The user's question determines which mode to run.

## Mode: health

**Trigger:** "Is the fleet healthy?", "check all projects", "what's broken?", "can I deploy everything?"

Checks git state, CI signal, and branch status across active projects listed in
`~/Desktop/fleet/README.md`.

```bash
bash ~/Desktop/fleet/fleet-ops/scripts/fleet-health.sh
bash ~/Desktop/fleet/fleet-ops/scripts/fleet-health.sh --no-fetch     # skip git fetch
bash ~/Desktop/fleet/fleet-ops/scripts/fleet-health.sh --only saas-maker,ai-game
```

The script reads the project list from the fleet README, so it stays in sync
automatically. For each project it checks:

1. **Git state** — clean? dirty?
2. **Branch** — on main?
3. **Remote sync** — ahead/behind?
4. **CI signal** — latest GitHub Actions run on main

Output a compact table:

```
PROJECT          BRANCH  GIT    CI     NOTES
saas-maker       main    clean  green  —
ai-game          main    dirty  green  2 uncommitted files
anime-list       main    clean  red    ci.yml failing
```

Summary: N clean, N dirty, N CI-red, N unknown.

**Act on results:**
- CI-red → investigate the failing workflow, fix or track
- Dirty → commit or stash before fleet operations
- Not on main → flag if deploy planned

## Mode: status

**Trigger:** "What's the fleet status?", "what's everyone working on?", "what shipped recently?", "what's blocked?"

Reads each project's `PROJECT_STATUS.md` (first 40 lines is enough for thesis +
timeline + scope). For each project extract:

- **Last updated** date
- **Thesis** (one line)
- **Latest timeline entry** (most recent ship)
- **Active scope** (what's IN scope)
- **Blockers** (if any)

Output:

```
## Fleet Status — YYYY-MM-DD

### Recently shipped (last 7 days)
- project-name: what shipped

### Active work
- project-name: current focus

### Blocked / deferred
- project-name: what's blocked and why

### Stale (PROJECT_STATUS.md not updated in 30+ days)
- project-name: last updated YYYY-MM-DD
```

Don't fabricate status — if a PROJECT_STATUS.md is missing or unreadable, report
that explicitly. This is read-only; it doesn't modify any files.

## Mode: full

**Trigger:** "Audit the fleet", "run the fleet audit", "prepare a fleet report", "triage fleet regressions"

Runs the SaaS Maker/Foundry fleet audit from the `saas-maker` repo:

```bash
cd ~/Desktop/fleet/saas-maker && pnpm fleet:audit
```

Writes to:
- `.symphony/fleet-audit/latest.md`
- `.symphony/fleet-audit/latest.json`

Variations:

```bash
pnpm fleet:audit -- --skip-local              # faster, skip local builds
pnpm fleet:audit -- --performance --lighthouse # full + perf checks
pnpm fleet:audit -- --project <slug>           # one project
```

### How to interpret

- `ok`: no open PRs, failed workflows, failed smoke checks, dirty state, or check failures.
- `watch`: open PRs or perf budget warnings; don't create urgent tasks unless stale or regressed.
- `fail`: real regression candidate; read details before creating tasks.

Expected non-issues:
- `api.sassmaker.com/` root may be `404`.
- `mal-api...workers.dev/` root may be `404`.
- `saas-maker` can be dirty during active local work; report but don't revert.
- First-run perf budget warnings are baselines, not regressions.

### Workflow

1. Run `pnpm fleet:audit` unless the user asks for a quick pass.
2. Read `.symphony/fleet-audit/latest.md`.
3. Summarize: open PRs, failed workflows, failed smoke checks, local failures, perf issues, dirty repos.
4. Propose or create Symphony tasks only for real regressions.
5. Do not auto-merge, deploy, delete Cloudflare projects, rotate secrets, or clean worktrees unless explicitly asked.

### Task creation rules

Create tasks for:
- latest main workflow failures
- failed production smoke checks
- local build/test/typecheck failures
- broken deploy pipeline

Do not create tasks for:
- known open PRs unless stale or blocking
- expected API-root 404s
- local dirty state in saas-maker during active work
- missing local OAuth credentials when builds pass

## Output style (all modes)

Keep reports compact:
- lead with overall status
- list real regressions first
- list watch items separately
- include links for PRs/actions when available
- include the report path (for full mode)
