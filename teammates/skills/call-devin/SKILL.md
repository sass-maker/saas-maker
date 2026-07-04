---
name: call-devin
description: "Delegate work to Devin CLI (Cognition's agent) as a teammate — long-running autonomous tasks, cloud/sandbox sessions that outlive your session, or OS-level-sandboxed local runs. Use when the user asks to call/delegate to devin, or for fire-and-forget work that should keep running after you're done. Costs ACUs — confirm spend for anything non-trivial."
---

# call-devin — delegate to Devin CLI as a teammate

Same stance as all teammate skills: specialist contractor; you brief, bound,
verify, accept or reject.

Installed here: `devin 2026.8.18`. Live-verified 2026-07-04: a sandboxed
test-fix delegation produced a minimal in-scope diff, ran the tests itself,
and reported honestly in a fenced JSON block. Devin bills in ACUs — keep
delegations scoped and surface expected spend for anything sizable.

## When to call Devin

- **Fire-and-forget / long-running work** — `devin cloud` sandbox sessions
  run remotely and outlive your local session; nothing else in the roster
  does that.
- **OS-level sandboxed local runs** — `--sandbox` enforces Read/Write scopes
  via macOS seatbelt; the strongest local isolation in the roster.
- **When its model roster helps** — `--model` accepts Claude models and
  `codex`, so one CLI can arbitrate across families.

## When NOT to call Devin

- Anything a local teammate covers equally well — codex/grok/claude cost a
  subscription call; Devin costs metered ACUs. Default elsewhere.
- Quick scoped edits (cold start + ACU overhead isn't worth it).
- Without the user's OK on spend for sizable tasks. Say the estimated scope.

## Command contract (verified live 2026-07-04)

Local non-interactive — **pick one authority model; they don't compose**
(verified: `--sandbox` warns "always uses the autonomous permission mode"
and ignores `--permission-mode`):

```bash
# OS-sandboxed autonomous (preferred for implementation): seatbelt-enforced
# read/write scopes, full-auto inside them
devin --sandbox --export <scratch>/devin_transcript.md -p -- "<brief>" < /dev/null

# Permission-gated, no OS sandbox (read-heavy/analysis work)
devin --permission-mode auto -p -- "<brief>" < /dev/null
```

| Flag | Purpose |
| --- | --- |
| `-p, --print` | Non-interactive: process prompt, print response, exit. |
| `-- <PROMPT>` | Prompt goes after `--` (or `--prompt-file <file>` for long briefs). |
| `--permission-mode` | `auto` (default, read-only auto-approved) \| `accept-edits` \| `smart` \| `dangerous`. Never `dangerous`. Ignored when `--sandbox` is set. |
| `--sandbox` | OS-level enforcement of read/write scopes (macOS seatbelt) + autonomous mode. Use for implementation runs. |
| `--model <m>` | e.g. `opus`, `claude-sonnet-4`, `codex`. |
| `--export [<path>]` | Write the transcript after each turn — your audit trail. |
| `-r, --resume [<id>]` | Resume a session (`devin list` shows sessions for the cwd). |
| `--agent-config <file>` | Declarative system instructions + tool visibility + permissions (strict parsing). |

Cloud (fire-and-forget): `devin cloud --help` for sandbox sessions, env
setup, and builds. Scope any cloud session tightly — it consumes ACUs until
done.

### Gotchas

- **No JSON output format** — stdout is prose. Ask for a fenced JSON block in
  the brief and parse it out; rely on `--export` + `git diff` as the real
  record.
- Workspace trust is skipped by default in print mode
  (`--respect-workspace-trust` defaults false for `-p`) — the permission mode
  and `--sandbox` are your actual guardrails.
- Append `< /dev/null` — same stdin hygiene as every teammate CLI.
- Devin has its own `rules`/`skills` subsystems that inject standing context;
  `devin rules list` / `devin skills list` before delegating in a repo you
  don't control, so you know what else is steering it.

## Briefing, safety, review, scorecard

Identical protocol to [call-codex](../call-codex/SKILL.md): brief with
GOAL/SCOPE/CONTEXT/VERIFY/RETURN
([template](../call-codex/references/codex-prompting.md)), clean checkout →
worktree, diff review for scope creep, independent tests, then one line in
`~/.claude/teammates/SCORECARD.md` — include ACUs/cost in the note.
Comparative routing: `~/.claude/teammates/ROSTER.md`.
