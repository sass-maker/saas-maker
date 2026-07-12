# Teammate roster — who to call for what

Comparative routing notes for the `call-*` teammate skills. Each skill owns
its own contract; this file only answers "who's the right teammate?".
Outcomes that should update these judgments live in [SCORECARD.md](SCORECARD.md).

| Teammate | Skill | Strong at | Weak at / cost | Verified |
| --- | --- | --- | --- | --- |
| Codex (`codex exec`, gpt-5.5) | `call-codex` | Scoped repo implementation, test-fix loops, `exec review`; only teammate with **schema-enforced output** (`--output-schema`) | No conversation context; slow at `high` effort; ~18k token floor/call | ✅ e2e 2026-07-03 |
| Grok (`grok -p`, grok-4.5) | `call-grok` | **best-of-N parallel attempts**, `--check` self-verify; third-family second opinion | No output schema; headless needs `--always-approve`; verify `stopReason` on JSON runs | ✅ smoke-tested 2026-07-12 |
| Hermes (`hermes`) | `call-hermes` | Optional open-source persistent skills, repeat-work learning, backup bot/provider lane | Needs model credentials and a named recurring job before it is useful | optional; gateway verified 2026-07-12 |
| Devin (`devin`) | `call-devin` | Optional proprietary autonomous teammate for expensive external attempts | ACU/spend + vendor lock-in; use only with explicit approval | ✅ CLI smoke-tested 2026-07-12; REST adapter credentials pending |

Routing heuristics:

- Scoped implementation with tests → **Codex** (schema output + verified loop).
- Hard/ambiguous but verifiable, worth N attempts → **Grok** `--best-of-n`.
- Review of the parent's own diff → **Grok** fresh context or **Codex** `exec review`.
- Repeatable learning workflow → **OpenClaw** by default; **Hermes** only when the workflow needs a separate persistent lane.
- External autonomous attempt worth proprietary spend → **Devin**, only after explicit approval.
- Needs your conversation context → nobody; do it yourself or use the
  in-session Agent tool.

## Usage-aware failover

Teammates run on separate model quotas/spend pools (Codex → ChatGPT plan, Grok
→ xAI plan, Devin → ACU/spend, Hermes → configured provider).
When one is exhausted, switch or park the task rather than waiting:

- **Implementation / test-fix**: Codex → Grok in a manually created worktree.
- **Implementation / test-fix**: Codex → Grok → Devin only if approved.
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
