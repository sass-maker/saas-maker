---
name: fleet-deploy-guard
description: Guard a fleet project deploy — verify clean main, green CI, known Cloudflare target, no uncommitted changes before allowing a deploy. Use when the user says "deploy X", "can I deploy?", "is X safe to deploy?", or before any production deploy.
---

# fleet-deploy-guard — deploy readiness gate

Verifies that a project is safe to deploy before allowing the deploy command
to run. Enforces the fleet deployment standard from AGENTS.md.

## When to invoke

- "Deploy X"
- "Can I deploy X?"
- "Is X safe to deploy?"
- "Check deploy readiness for X"
- Before running `wrangler deploy`, `pnpm deploy`, or any deploy command

## What it checks

1. **On main branch** — not a feature branch
2. **Clean working tree** — no uncommitted changes
3. **Synced with remote** — not ahead or behind
4. **CI green on main** — latest GitHub Actions run is passing
5. **Cloudflare target known** — wrangler.toml/jsonc exists and names a Worker/Pages project
6. **No known regressions** — check PROJECT_STATUS.md for any flagged blockers

## How to invoke

```bash
# From the project directory:
bash ~/Desktop/fleet/fleet-ops/scripts/deploy-health.sh
```

Or manually check each gate:

```bash
# 1. On main?
git branch --show-current

# 2. Clean?
git status --porcelain

# 3. Synced?
git status -sb | head -1

# 4. CI green?
gh run list --branch main --limit 1 --json conclusion -q '.[0].conclusion'

# 5. Cloudflare target?
grep -E 'name\s*=' wrangler.toml wrangler.jsonc 2>/dev/null
```

## Output

```
PROJECT: <name>
Branch:     main ✓
Git:        clean ✓
Remote:     synced ✓
CI:         green ✓
CF target:  <worker-name> ✓
Blockers:   none ✓

→ READY TO DEPLOY
```

Or if any gate fails:

```
PROJECT: <name>
Branch:     feat/experimental ✗ (not main)
Git:        dirty ✗ (3 uncommitted files)
...

→ NOT READY — fix the issues above before deploying
```

## Rules

- **Never bypass the guard** — if a gate fails, report it and stop
- **Never deploy from a dirty tree** — commit or stash first
- **Never deploy with red CI** — fix the CI failure first
- **Exception:** if CI is red for reasons unrelated to the deploy change, the
  user can explicitly override — but the exception must be named in the handoff
