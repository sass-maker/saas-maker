---
name: fleet-ops
description: Fleet operations — audit the fleet, scaffold a new project, guard a deploy, or make cross-project workspace decisions. Use when the user asks about fleet health, fleet status, creating a new project, deploy readiness, workspace structure, or any cross-fleet operational task. Routes to the right subskill based on intent.
---

# fleet-ops — parent skill

Routes to the right subskill based on what the user is asking for.
Subskills live as sibling directories under `fleet-ops/skills/`.

## Routing table

| User intent | Subskill | Path |
|---|---|---|
| "Is the fleet healthy?" / "check all projects" / "what's broken?" / "fleet status" / "what's everyone working on?" / "audit the fleet" | `fleet-audit` | `../fleet-audit/SKILL.md` |
| "Create a new project" / "scaffold X" / "add a new fleet product" / "init a new repo" | `fleet-init` | `../fleet-init/SKILL.md` |
| "Deploy X" / "can I deploy?" / "is X safe to deploy?" / "check deploy readiness" | `fleet-deploy-guard` | `../fleet-deploy-guard/SKILL.md` |
| "Does this work belong in a child project or fleet-ops?" / cross-project workspace decisions | `fleet-workspace` | `../fleet-workspace/SKILL.md` |

## How to use

1. Read the user's request and match it to a row in the routing table.
2. Read the subskill's SKILL.md for the full contract (triggers, commands, output format).
3. Follow that subskill's instructions.

If the request spans multiple subskills (e.g. "audit the fleet, then scaffold a new project for the gap you find"), run them in sequence.

## What this skill does NOT cover

- Delegating to other agent CLIs → use the `call-teammate` skill
- Domain name generation → use `name-domains` skill
- Lighthouse/perf audits → use `psi-swarm` skill
- AI crawler readiness → use `agent-ready` skill
- On-page SEO audits → use `seo-audit` skill
- Codex context/token audits → use `token-budget` skill
