# agent-teammates — delegation skill pack

Canonical, version-controlled home of the fleet's agent-to-agent delegation
layer: skills that teach a parent agent when to call another agent CLI, how
to brief it, how much authority to give it, and how to verify its work.

## Layout

- `skills/call-codex/` — Codex CLI (`codex exec`); schema-enforced output;
  the schemas and briefing template here are canonical for all teammates.
- `skills/call-grok/` — Grok CLI; best-of-N, self-check, native worktrees.
- `skills/call-claude-code/` — fresh headless Claude Code; both profiles.
- `skills/call-devin/` — Devin CLI; cloud sessions; ACU-metered.
- `skills/call-cursor/` — Cursor Agent CLI; fast implementation; verified
  worktree isolation; separate quota.
- `ROSTER.md` — comparative routing table (who is strong at what).
- `SCORECARD.md` — append-only outcome log, one line per delegation.

## Wiring (how agents actually find these)

Claude Code discovers skills via symlinks from the profile skill dirs:

```
~/.claude/skills/call-*      -> ~/Desktop/fleet/fleet-ops/teammates/skills/call-*
~/.claude-work/skills        -> ~/.claude/skills          (whole-dir symlink)
~/.claude/teammates          -> ~/Desktop/fleet/fleet-ops/teammates
```

Both hops are verified working (skill discovery follows symlinks). Other
agents (codex, grok, devin) learn the protocol from the "Agent teammate
delegation" section of the fleet [`AGENTS.md`](../AGENTS.md).

Edit skills here, never in `~/.claude/skills` (those are links). New teammate
= new `skills/call-<name>/SKILL.md` + a symlink + a ROSTER.md row.
