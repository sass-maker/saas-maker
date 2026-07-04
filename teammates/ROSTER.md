# Teammate roster — who to call for what

Comparative routing notes for the `call-*` teammate skills. Each skill owns
its own contract; this file only answers "who's the right teammate?".
Outcomes that should update these judgments live in [SCORECARD.md](SCORECARD.md).

| Teammate | Skill | Strong at | Weak at / cost | Verified |
| --- | --- | --- | --- | --- |
| Codex (`codex exec`, gpt-5.5) | `call-codex` | Scoped repo implementation, test-fix loops, `exec review`; only teammate with **schema-enforced output** (`--output-schema`) | No conversation context; slow at `high` effort; ~18k token floor/call | ✅ e2e 2026-07-03 |
| Grok (`grok -p`, grok-build) | `call-grok` | **best-of-N parallel attempts**, `--check` self-verify; third-family second opinion | No output schema; headless needs `--always-approve` (prompts silently cancel, exit 0); `-w` doesn't isolate headless — manual worktree required | ✅ full agentic e2e |
| Claude Code (`claude -p`) | `call-claude-code` | Fresh-context unbiased review; parallel worker; **two profiles** (personal `~/.claude`, work `~/.claude-work`); `--json-schema` | Same family as parent (no model diversity); cold-start overhead vs in-session Agent tool | ✅ w/ json-schema |
| Devin (`devin -p` / `cloud`) | `call-devin` | **Fire-and-forget cloud sessions** that outlive you; OS-level `--sandbox`; multi-model (`--model codex`) | **ACU-metered** — default elsewhere; no JSON output; `--sandbox` forces autonomous mode (ignores `--permission-mode`) | ✅ sandboxed e2e |
| Cursor (`cursor-agent -p`) | `call-cursor` | Fast scoped implementation (~11 s on the benchmark task); **verified `-w` worktree isolation**; read-only `--mode plan/ask`; cross-family `--model` roster; separate Cursor quota | No output schema; `--force` needed headless (isolation mandatory) | ✅ e2e + worktree |

Routing heuristics:

- Scoped implementation with tests → **Codex** (schema output + verified loop).
- Hard/ambiguous but verifiable, worth N attempts → **Grok** `--best-of-n`.
- Review of the parent's own diff → **Claude Code** fresh instance (no
  conversation bias) or **Codex** `exec review` (model diversity). Both when
  it matters.
- Must keep running after this session ends → **Devin** cloud (confirm spend).
- Needs your conversation context → nobody; do it yourself or use the
  in-session Agent tool.

## Usage-aware failover

Teammates run on separate quotas (codex → ChatGPT plan, grok → xAI plan,
claude → Anthropic plan × 2 profiles, devin → ACUs). When one is exhausted,
switch instead of waiting — the task decides the chain, not loyalty:

- **Implementation / test-fix**: codex → cursor (`-w` worktree) →
  claude-code (work profile → personal profile) → grok
  (`--always-approve` + manual worktree).
- **Review / second opinion**: codex `exec review` → cursor `--mode ask` →
  grok → claude-code. (Prefer keeping model diversity: if the parent is
  Claude, exhaust the non-Anthropic reviewers first.)
- **Devin is never an automatic fallback** — ACU-metered; requires explicit
  user sign-off on spend.

Detection is reactive (none of these CLIs exposes a reliable headless quota
pre-check): a call failing with a rate-limit/usage/quota error = exhausted.
Rules:

1. Don't retry a quota failure on the same teammate; move down the chain.
2. Re-brief from scratch — the replacement saw nothing of the failed call.
3. Log the switch in [SCORECARD.md](SCORECARD.md) (verdict `blocked`, note
   `quota — failed over to <teammate>`), so recurring exhaustion patterns
   become routing data.
4. If the whole chain is exhausted, do the task yourself or park it — never
   silently drop it.

Removed from the roster: **Aider** (2026-07-03 — installed but no API key on
this machine, and superseded by the above for every niche it covered).
