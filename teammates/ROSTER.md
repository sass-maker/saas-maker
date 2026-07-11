# Teammate roster — who to call for what

Comparative routing notes for the `call-*` teammate skills. Each skill owns
its own contract; this file only answers "who's the right teammate?".
Outcomes that should update these judgments live in [SCORECARD.md](SCORECARD.md).

| Teammate | Skill | Strong at | Weak at / cost | Verified |
| --- | --- | --- | --- | --- |
| Codex (`codex exec`, gpt-5.5) | `call-codex` | Scoped repo implementation, test-fix loops, `exec review`; only teammate with **schema-enforced output** (`--output-schema`) | No conversation context; slow at `high` effort; ~18k token floor/call | ✅ e2e 2026-07-03 |
| Grok (`grok -p`, grok-build) | `call-grok` | **best-of-N parallel attempts**, `--check` self-verify; third-family second opinion | No output schema; headless needs `--always-approve` (prompts silently cancel, exit 0); `-w` doesn't isolate headless — manual worktree required | ✅ full agentic e2e |
| Hermes (`hermes`) | `call-hermes` | Open-source persistent skills and repeat-work learning | Keep gateway/channels off unless a concrete workflow needs them | pending local setup |

Routing heuristics:

- Scoped implementation with tests → **Codex** (schema output + verified loop).
- Hard/ambiguous but verifiable, worth N attempts → **Grok** `--best-of-n`.
- Review of the parent's own diff → **Grok** fresh context or **Codex** `exec review`.
- Repeatable learning workflow → **Hermes**, with an explicit workspace and scope.
- Needs your conversation context → nobody; do it yourself or use the
  in-session Agent tool.

## Usage-aware failover

Teammates run on separate model quotas (Codex → ChatGPT plan, Grok → xAI plan).
When one is exhausted, switch or park the task rather than waiting:

- **Implementation / test-fix**: Codex → Grok in a manually created worktree.
- **Review / second opinion**: Codex `exec review` → Grok.

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
