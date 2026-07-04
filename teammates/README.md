# teammates — delegation skill pack

Canonical, version-controlled home of the fleet's agent-to-agent delegation
layer: skills that teach a parent agent when to call another agent CLI, how
to brief it, how much authority to give it, and how to verify its work.

## Layout

- `skills/call-teammate/` — **parent skill**: routes to the right subskill based on which CLI the user names. Start here.
- `skills/call-codex/` — Codex CLI (`codex exec`); schema-enforced output.
- `skills/call-grok/` — Grok CLI; best-of-N, self-check, native worktrees.
- `skills/call-claude-code/` — fresh headless Claude Code; both profiles.
- `skills/call-devin/` — Devin CLI; cloud sessions; ACU-metered.
- `skills/call-cursor/` — Cursor Agent CLI; fast implementation; verified worktree isolation; separate quota.
- `ROSTER.md` — comparative routing table (who is strong at what).
- `SCORECARD.md` — append-only outcome log, one line per delegation.

## Skill discovery (progressive disclosure)

Only the `call-teammate` parent skill is symlinked into agent skill dirs.
The 5 `call-*` subskills are loaded on demand via the parent's routing table.

Agent skill dirs wired (symlinks point to `fleet-ops/` paths):
```
~/.claude/skills/call-teammate      -> ~/Desktop/fleet/fleet-ops/teammates/skills/call-teammate
~/.codex/skills/call-teammate       -> ~/Desktop/fleet/fleet-ops/teammates/skills/call-teammate
~/.cursor/skills/call-teammate      -> ~/Desktop/fleet/fleet-ops/teammates/skills/call-teammate
~/.config/devin/skills/call-teammate -> ~/Desktop/fleet/fleet-ops/teammates/skills/call-teammate
~/.claude/teammates                 -> ~/Desktop/fleet/fleet-ops/teammates
```

All 4 agent runtimes (Claude Code, Codex, Cursor, Devin) discover the parent
skill via symlink. The parent's routing table tells the agent which subskill
to read for the specific CLI the user named.

Edit skills here, never in `~/.claude/skills` or other agent dirs (those are
symlinks). New teammate = new `skills/call-<name>/SKILL.md` + a row in the
`call-teammate` routing table + a `ROSTER.md` row.
