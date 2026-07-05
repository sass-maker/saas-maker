---
name: call-teammate
description: Delegate work to another agent CLI as a teammate — Claude Code, Codex, Cursor Agent, Devin, or Grok. Use when the user asks to call/delegate to another agent, wants a second opinion from a different model, wants parallel attempts on a hard task, or wants fire-and-forget work that outlives the current session. Routes to the right subskill based on which teammate the user names.
---

# call-teammate — parent skill

Routes to the right teammate subskill based on which CLI the user wants to
delegate to. Subskills live as sibling directories under `fleet-ops/teammates/skills/`.

## Routing table

| User intent | Subskill | Path | Strengths |
|---|---|---|---|
| "delegate to claude" / "call claude-code" / "fresh Claude with clean context" / "run under the other profile" | `call-claude-code` | `../call-claude-code/SKILL.md` | Fresh context, no conversation bias, personal vs work profile |
| "delegate to codex" / "call codex" / "second opinion from a different model" / "mechanical refactor / test-fix loop" | `call-codex` | `../call-codex/SKILL.md` | OpenAI model family, scoped implementation, independent review |
| "delegate to cursor" / "call cursor" / "implementation fallback" / "access Cursor's model roster" | `call-cursor` | `../call-cursor/SKILL.md` | GPT/Claude/Gemini variants, separate quota, plan/ask modes |
| "delegate to devin" / "call devin" / "long-running autonomous task" / "cloud/sandbox session" / "fire-and-forget" | `call-devin` | `../call-devin/SKILL.md` | Long-running, cloud sessions, high-autonomy local runs. ACU-metered — surface spend for large tasks. |
| "delegate to grok" / "call grok" / "N parallel attempts" / "cross-model second opinion" / "non-Anthropic/non-OpenAI opinion" | `call-grok` | `../call-grok/SKILL.md` | xAI model family, native worktree isolation, best-of-N attempts |

## How to use

1. Identify which teammate the user is asking for (by name or by the task shape).
2. Read the subskill's SKILL.md for the full contract (invocation syntax, briefing template, output schema, safety bounds).
3. Follow that subskill's instructions.

## Shared rules (all teammates)

Regardless of which teammate you call:

- **Explicit sandbox/permission flags** — never rely on CLI config defaults.
- **Delegate from a clean checkout into a worktree** — don't delegate from a dirty tree.
- **`< /dev/null` on every invocation** — prevent stdin hang.
- **Verify diffs and tests yourself** — the teammate's output is a draft, not a finished product.
- **Devin is ACU-metered** — surface expected spend/scope for large tasks. A direct "delegate/call Devin" or "use max permissions" request counts as OK for a bounded run; do not stop for a second confirmation unless the task is broad, recurring, or likely multi-hour.
- **Fail over down the chain** if a teammate hits usage/rate limits — see `fleet-ops/teammates/ROSTER.md` for the chain order. Log the switch in `fleet-ops/teammates/SCORECARD.md`.
- **Don't retry an exhausted teammate** or silently drop the task.

## Roster and outcomes

- **Routing:** `fleet-ops/teammates/ROSTER.md` — who is strong at what.
- **Outcomes:** `fleet-ops/teammates/SCORECARD.md` — append one line per delegation; skim before delegating similar work.
