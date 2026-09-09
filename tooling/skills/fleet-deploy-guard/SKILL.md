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
4. **CI green for current main** — every observed exact-`HEAD`/`main` push workflow has a completed, successful latest run/attempt. At least one successful workflow must have a source-backed build/test command; a Docs-only result cannot establish readiness. Manual and scheduled runs never substitute for push evidence.
5. **Cloudflare target known** — wrangler.toml/jsonc exists and names a Worker/Pages project
6. **No known regressions** — check PROJECT_STATUS.md for any flagged blockers

## How to invoke

```bash
bash ~/Desktop/fleet/saas-maker/tooling/scripts/fleet-deploy-guard.sh <project>
bash ~/Desktop/fleet/saas-maker/tooling/scripts/fleet-deploy-guard.sh codevetter
bash ~/Desktop/fleet/saas-maker/tooling/scripts/fleet-deploy-guard.sh codevetter --force  # skip CI check
```

The script checks all 6 gates and exits non-zero if any fail. Use `--force` to
skip the CI gate (only when CI is red for unrelated reasons — name the exception
in the handoff).

## CI evidence limits

The gate reads all pages of GitHub run and workflow metadata, matches workflow
IDs to their checked-in paths, and inspects literal `run` steps without
executing them. Simple package-script calls are resolved from the owning
`package.json` at the exact checked Git revision; direct test/build commands are recognized independently of
workflow display names. Node.js is required for this read-only inspection.

Pending, failed, cancelled, skipped, missing/disabled, non-exact or malformed
workflow evidence fails closed. The recognizer intentionally does not interpret
arbitrary YAML/shell, quoted commands, reusable actions, or dynamic
working-directory overrides. Unrecognized source is **unknown**, not
green. This is a workflow-completion/source-definition gate, not proof that
every conditionally skipped step actually executed. Review product-specific
acceptance separately. The existing explicitly approved `--force` exception is
unchanged; this repair adds no bypass or ancestor-run inheritance.

Conditional (`if`) or error-tolerant (`continue-on-error`) jobs/steps cannot
establish build/test identity. An independent unconditional step in another job
or beside an optional step may qualify. The source recognizer accepts only
conventional block mappings: `jobs` at column 0, literal job IDs at 2, job fields
at 4, step list items at 6 and step fields at 8. Dependency-gated jobs (`needs`),
matrices, aliases/merge keys, quoted mapping keys, custom shells and unsupported
layouts remain unknown. A conventional job `defaults.run.working-directory`
containing one unquoted literal path can qualify direct `pytest`, `python -m
pytest` or `uv run pytest`, or a simple package-script call resolved from that
directory's tracked manifest. A literal step directory overrides its job default;
neither can borrow scripts from a different package. Absolute paths, parent
traversal, ignored manifests and symlinks escaping the checkout are rejected.
Directory-changing shell commands are not interpreted. Directory scope stays
within its job/step, so an
unrelated Python job cannot disable root package-script evidence. Dynamic paths,
unknown default mappings and workflow-level defaults remain unknown.
Shell early exits, conditional programs, failure masking, pipelines, redirection,
interpolation and opaque/reusable validation fail closed. This remains a narrow
source-definition check, not a general YAML/shell interpreter or runtime test
coverage guarantee.

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
