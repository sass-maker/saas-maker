# fleet-ops — fleet tooling

Single version-controlled home for all fleet tooling: skills, scripts, docs,
templates, teammates, and the psi-swarm tool.

## Structure

```
fleet-ops/
├── skills/              ← fleet operational skills
│   ├── fleet-ops/       ← parent: routes to fleet-audit, fleet-init, fleet-deploy-guard, fleet-workspace
│   ├── fleet-audit/     ← subskill: fleet health / status / full audit (3 modes)
│   ├── fleet-init/      ← subskill: scaffold new fleet projects
│   ├── fleet-deploy-guard/ ← subskill: deploy readiness gate
│   ├── fleet-workspace/ ← subskill: cross-project workspace decisions
│   ├── name-domains/    ← standalone: domain name generation
│   ├── codevetter-install/ ← standalone: reinstall CodeVetter desktop app
│   ├── spec-driven/     ← standalone: OpenSpec spec-driven dev workflow for new features
│   ├── agent-ready/     ← standalone: AI crawler readiness scan (isitagentready.com)
│   └── seo-audit/       ← standalone: on-page SEO audit (meta, OG, JSON-LD, headings, alt, SSR leaks)
├── teammates/           ← delegation skills + roster + scorecard
│   └── skills/
│       ├── call-teammate/ ← parent: routes to 5 call-* subskills
│       ├── call-claude-code/ call-codex/ call-cursor/ call-devin/ call-grok/
│       ├── ROSTER.md     ← who is strong at what
│       └── SCORECARD.md  ← append-only delegation outcome log
├── psi-swarm/           ← Lighthouse perf audits (skill + CLI tool)
├── scripts/             ← fleet scripts (health, perf sweeps, bench-launch, link/unlink)
├── docs/                ← living docs (runbook, agent-layering, perf-monitoring)
│   └── archive/         ← dated snapshots (not living reference)
└── templates/           ← shared code templates (api-timing.ts)
```

## Skill discovery model

Only 8 skills are symlinked into each agent's skill dir — 2 parents + 6 standalones.
Agents load the parent, read the routing table, then load the relevant subskill
on demand (progressive disclosure).

| Symlink | Type | Routes to |
|---|---|---|
| `fleet-ops` | parent | fleet-audit, fleet-init, fleet-deploy-guard, fleet-workspace |
| `call-teammate` | parent | call-claude-code, call-codex, call-cursor, call-devin, call-grok |
| `name-domains` | standalone | — |
| `codevetter-install` | standalone | — |
| `spec-driven` | standalone | — |
| `psi-swarm` | standalone | — |
| `agent-ready` | standalone | — |
| `seo-audit` | standalone | — |

Wired into: `~/.claude/skills/`, `~/.codex/skills/`, `~/.cursor/skills/`, `~/.config/devin/skills/`

## Adding a new skill

1. Create `skills/<name>/SKILL.md` (or `teammates/skills/<name>/SKILL.md` for delegation).
2. If it belongs under an existing parent, add a row to the parent's routing table — no new symlink needed.
3. If standalone, symlink it into each agent skill dir:
   ```bash
   for dir in ~/.claude/skills ~/.codex/skills ~/.cursor/skills ~/.config/devin/skills; do
     ln -s ~/Desktop/fleet/fleet-ops/skills/<name> "$dir/<name>"
   done
   ```
4. Commit and push.

## Adding a new script

1. Add the script to `scripts/`.
2. If it needs a skill wrapper (for agent discovery), create a skill under `skills/` and add it to the parent routing table or as a standalone.
3. Commit and push.

## Editing skills

Edit SKILL.md files in this repo. Never edit in `~/.claude/skills/` or other
agent dirs — those are symlinks. Changes here propagate to all 4 agent
runtimes automatically.
