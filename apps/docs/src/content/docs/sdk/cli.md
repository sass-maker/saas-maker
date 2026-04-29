---
title: Foundry CLI (fnd)
description: The unified command-line interface for the project fleet.
---

The Foundry CLI (`fnd` or `foundry`) is the primary orchestration tool for the Software Factory. It allows you to manage, audit, and evolve your entire project fleet from a single interface.

## 🛠️ Installation

```bash
pnpm add -g @saas-maker/cli
```

## 🏗️ The Forge (Scaffolding)

Start a new project that is 100% Foundry-compliant from day one.

```bash
fnd forge --name <project-slug> --type [next|vite|node]
```
- **What it does**: Creates a project directory, initializes `package.json`, links Gold Standards, sets up the Operational Layer (`ops`, `db`, `shield`), and writes an `AGENTS.md` foreman file.

## 🚢 Fleet Commander (Orchestration)

Commands that operate across your entire `~/Desktop/Fleet` folder.

| Command | Purpose |
|---------|---------|
| `fnd fleet list` | Show all projects, statuses, and mission statements. |
| `fnd fleet audit` | Deep health check (Standard drift + Code Health via Fallow). |
| `fnd fleet fix` | Automatically correct standard drift and deploy CI/CD. |
| `fnd fleet run "<cmd>"` | Execute any shell command across all projects in parallel. |
| `fnd fleet versions [list|fix]` | Eliminate dependency drift across the whole fleet. |
| `fnd fleet secrets-sync` | Push shared environment variables to all `.env.local` files. |
| `fnd fleet clean [--deep]` | Reclaim gigabytes of storage by purging build caches and Rust targets. |

## 🧭 Project Metadata

Use the universal API command for project notes and rate-limit changes.

```bash
fnd api PATCH /v1/projects/<projectId> --auth session \
  --body '{"readme":"Dashboard notes for this project.","rate_limit_enabled":true,"rate_limit_rpm":100000}'
```

## 🤖 Autonomous Maintenance

Run the factory on auto-pilot.

```bash
fnd fleet supervise
```
- **The Daemon**: Watches your Cockpit's Global Error Feed.
- **Auto-Fix**: When an error is detected, it automatically dispatches an AI agent to the failing project to debug and commit a fix using your specific `skills/` protocols.

## 🧬 Evolutionary Refactoring

Mass-apply architectural changes to the entire fleet.

```bash
fnd fleet apply <skill-name>
```
- **Example**: `fnd fleet apply protocol-migration`
- Dispatches a swarm of agents to update every repo based on a protocol in your `skills/` registry.
