# Agent Layering

Fleet uses three explicit layers for agent behavior.

## Machine Level

Machine-level config lives outside this repository:

- `~/.claude/`
- `~/.codex/`
- `~/.agents/skills/`

Use it for personal defaults, credentials, caches, installed plugins, and
machine-specific state. Do not put Fleet policy here by default because it makes
Fleet behavior available in unrelated projects.

## Fleet Level

Fleet-level config lives in this repository:

- `AGENTS.md` is the Codex-facing canonical policy.
- `CLAUDE.md` is the Claude-facing bridge to `AGENTS.md`.
- `.agents/skills/` stores Fleet-owned Codex skills.
- `.claude/skills/` stores Fleet-owned Claude skills.

This is the source of truth for shared Fleet behavior.

## Project Level

Each child project remains its own repository. A project opts into Fleet behavior
by linking Fleet skills into project-local skill folders and adding a small
reference to the Fleet policy files.

Use:

```bash
./scripts/link-project-agent-assets.sh reader karte
```

or link every immediate child Git repository:

```bash
./scripts/link-project-agent-assets.sh
```

The script adds:

- `.agents/skills/<fleet-skill>` symlinks for Codex.
- `.claude/skills/<fleet-skill>` symlinks for Claude.
- a managed Fleet reference block in project `AGENTS.md`.
- a managed `@../CLAUDE.md` import block in project `CLAUDE.md`.

Remove the links and managed reference blocks with:

```bash
./scripts/unlink-project-agent-assets.sh reader karte
```

## Why Not Global Install?

Global installation is convenient, but it makes Fleet skills visible everywhere.
Project-level opt-in keeps Fleet behavior scoped to Fleet projects while still
letting Fleet own and version the shared assets.
