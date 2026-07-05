---
name: call-devin
description: "Delegate work to Devin CLI (Cognition's agent) as a teammate — long-running autonomous tasks, cloud/sandbox sessions that outlive your session, or high-autonomy local runs. Use when the user asks to call/delegate to devin, or for fire-and-forget work that should keep running after you're done. Costs ACUs — surface expected spend for large tasks."
---

# call-devin — delegate to Devin CLI as a teammate

Same stance as all teammate skills: specialist contractor; you brief, bound,
verify, accept or reject.

Installed here: `devin 2026.8.18`. Live-verified 2026-07-04: a sandboxed
test-fix delegation produced a minimal in-scope diff, ran the tests itself,
and reported honestly in a fenced JSON block.

Sarthak's standing preference: trust teammate agents and give Devin maximum
local autonomy. Default to `--permission-mode dangerous` for local Devin
delegations unless the user explicitly asks for sandboxing, read-only review,
or a low-permission run. Devin bills in ACUs — keep delegations scoped and
surface expected spend for large/open-ended tasks, but do not block for a
second confirmation when the user has already asked to delegate to Devin or
asked for max autonomy.

## When to call Devin

- **Fire-and-forget / long-running work** — `devin cloud` sandbox sessions
  run remotely and outlive your local session; nothing else in the roster
  does that.
- **High-autonomy local runs** — `--permission-mode dangerous` lets Devin read,
  edit, and run commands without approval prompts. This is the default for
  trusted local delegation.
- **OS-level sandboxed local runs** — `--sandbox` enforces Read/Write scopes
  via macOS seatbelt. Use it only when the user asks for isolation or when
  risky external code should be contained.
- **When its model roster helps** — `--model` accepts Claude models and
  `codex`, so one CLI can arbitrate across families.

## When NOT to call Devin

- Anything a local teammate covers equally well — codex/grok/claude cost a
  subscription call; Devin costs metered ACUs. Default elsewhere.
- Quick scoped edits (cold start + ACU overhead isn't worth it).
- Without the user's OK on spend for sizable tasks. A direct "delegate/call
  Devin" or "use max permissions" request counts as OK for a bounded run.
  For broad, multi-hour, or recurring work, state the expected scope/cost.

## Command contract (verified live 2026-07-04)

Local non-interactive — **pick one authority model; they don't compose**
(verified: `--sandbox` warns "always uses the autonomous permission mode"
and ignores `--permission-mode`):

```bash
# Max-autonomy local delegation (default): full local permissions, no approval
# prompts. Use from a clean worktree and give Devin clear scope boundaries.
devin --permission-mode dangerous --export <scratch>/devin_transcript.md -p -- "<brief>" < /dev/null

# OS-sandboxed autonomous: seatbelt-enforced read/write scopes, full-auto inside
# them. Use only when isolation matters more than broad local autonomy.
devin --sandbox --export <scratch>/devin_transcript.md -p -- "<brief>" < /dev/null

# Permission-gated, no OS sandbox (only when the user asks for low-risk review)
devin --permission-mode auto -p -- "<brief>" < /dev/null
```

| Flag | Purpose |
| --- | --- |
| `-p, --print` | Non-interactive: process prompt, print response, exit. |
| `-- <PROMPT>` | Prompt goes after `--` (or `--prompt-file <file>` for long briefs). |
| `--permission-mode` | `auto` (read-only auto-approved) \| `accept-edits` \| `smart` \| `dangerous`. Default to `dangerous` for trusted local Devin delegation. Ignored when `--sandbox` is set. |
| `--sandbox` | OS-level enforcement of read/write scopes (macOS seatbelt) + autonomous mode. Use only when isolation matters more than broad local autonomy. |
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
  is the actual authority setting. With `dangerous`, the brief and clean
  worktree are the guardrails.
- Append `< /dev/null` — same stdin hygiene as every teammate CLI.
- Devin has its own `rules`/`skills` subsystems that inject standing context;
  `devin rules list` / `devin skills list` before delegating in a repo you
  don't control, so you know what else is steering it.

### Required brief guardrails for dangerous mode

Because `--permission-mode dangerous` bypasses approval prompts, the brief must
be specific about:

- exact goal and expected deliverable,
- files/areas in scope,
- tests or checks Devin should run,
- whether commits, pushes, deploys, migrations, credential changes, production
  config edits, or destructive commands are allowed. Default: not allowed unless
  the user explicitly asked for them.

## Briefing, safety, review, scorecard

Identical protocol to [call-codex](../call-codex/SKILL.md): brief with
GOAL/SCOPE/CONTEXT/VERIFY/RETURN
([template](../call-codex/references/codex-prompting.md)), clean checkout →
worktree, diff review for scope creep, independent tests, then one line in
`~/.claude/teammates/SCORECARD.md` — include ACUs/cost in the note.
Comparative routing: `~/.claude/teammates/ROSTER.md`.
