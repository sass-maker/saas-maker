# teammates — delegation skill pack

Canonical, version-controlled home of the fleet's agent-to-agent delegation
layer: skills that teach a parent agent when to call another agent CLI, how
to brief it, how much authority to give it, and how to verify its work.

## Layout

- `skills/call-teammate/` — **parent skill**: routes to the right subskill based on which CLI the user names. Start here.
- `skills/call-codex/` — Codex CLI (`codex exec`); schema-enforced output.
- `skills/call-grok/` — Grok CLI; best-of-N, self-check, native worktrees.
- `skills/call-hermes/` — local open-source persistent specialist.
- `ROSTER.md` — comparative routing table (who is strong at what).
- `SCORECARD.md` — append-only outcome log, one line per delegation.

## Skill discovery (progressive disclosure)

Only the `call-teammate` parent skill is symlinked into Codex. The open-source
subskills are loaded on demand via the parent's routing table.

Agent skill dirs wired (symlinks point to `fleet-ops/` paths):
```
~/.codex/skills/call-teammate       -> ~/Desktop/fleet/fleet-ops/teammates/skills/call-teammate
```

Codex discovers the parent skill via symlink. Hermes is configured as its own
open-source runtime and follows the same versioned Fleet Ops guidance.

Edit skills here, never in `~/.claude/skills` or other agent dirs (those are
symlinks). New teammate = new `skills/call-<name>/SKILL.md` + a row in the
`call-teammate` routing table + a `ROSTER.md` row.
