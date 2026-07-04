---
name: fleet-workspace
description: Use when working across the Fleet workspace, deciding whether work belongs in a child project, Fleet policy, or project-local task tracking.
---

# Fleet Workspace

Use this skill for Fleet-wide workspace decisions and cross-project maintenance.

## Read First

1. Read the nearest project `AGENTS.md`.
2. Read `/Users/sarthakagrawal/Desktop/Fleet/AGENTS.md` for Fleet-wide policy.
3. If Claude-specific context is needed, read `/Users/sarthakagrawal/Desktop/Fleet/CLAUDE.md`.

## Rules

- Treat each immediate child directory with its own `.git/` as an independent
  repository.
- Keep shared workspace policy in the Fleet root.
- Keep project-specific build, deploy, and architecture rules in the child
  project.
- Prefer Symphony tasks over new plan docs for operational follow-up.
- Do not install Fleet behavior globally unless the user explicitly asks for
  Fleet behavior to appear outside `/Users/sarthakagrawal/Desktop/Fleet`.

## When Adding Shared Agent Assets

- Put Codex skills in `Fleet/.agents/skills/`.
- Put Claude skills in `Fleet/.claude/skills/`.
- Use `Fleet/scripts/link-project-agent-assets.sh` to expose them to child
  projects.
- Keep global machine config private and personal.
