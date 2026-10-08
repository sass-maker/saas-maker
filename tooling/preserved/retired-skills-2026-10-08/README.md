# Retired skills (2026-10-08)

Skills removed from `tooling/skills/` during the 2026-10-08 agent-rules
cleanup. Each `SKILL.md` was renamed to `SKILL.md.retired` so no agent runtime
loads it. Kept for history and recovery, not as runnable skills.

| Retired | Reason |
|---|---|
| `psi-swarm` | Router to the PSI Swarm repository, which is archived at `~/Desktop/fleet-archive/psi-swarm`. Use `web-perf` for performance work. |
| `openspec-*` (6) | Local `openspec/` spec workflow. Conflicted with `spec-driven`, which forbids local spec files. |
| `evidence-research` | Retired with no active owner. |
| `daily-learning`, `glyph-art`, `ian-xiaohei-illustrations`, `ios-app-growth`, `local-verification`, `screenmap`, `token-budget` | Never invoked in Codex (Aug–Oct 2026) or Claude (since 2026-09-13) session usage; owner approved removal. The `verify-local.mjs` engine behind `local-verification` stays active in `tooling/scripts`. |

Merged skills keep their content in the survivor's `references/`; only their
execution profiles and agent metadata are kept here:

| Merged | Survivor |
|---|---|
| `launchkit` | `launch-campaign` (`references/launchkit-directory-run.md`) |
| `apple-platform` | `apple-native` (`references/platform-contract.md`) |
| `fleet-deploy-guard` | `fleet-deploy-parity` (`references/deploy-guard.md`) |
| `clarity-fleet-rollout` | `clarity-fleet-health` (`references/rollout.md`) |
| `call-hermes` | `call-teammate` (`references/hermes.md`) |

To restore one, move it back under `tooling/skills/`, rename
`SKILL.md.retired` to `SKILL.md`, and re-add it to the exposure list in
`tooling/scripts/agent-stack.sh` if it should be linked.
