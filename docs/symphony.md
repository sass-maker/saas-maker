# Foundry Symphony

Foundry Symphony is the task-backed orchestration layer for this repository.
It follows the OpenAI Symphony shape, but uses the existing cockpit task list as
the tracker instead of adding a separate issue board.

## Boundary

- Production `/v1/tasks` is the source of truth for work.
- `WORKFLOW.md` is the source of truth for agent execution policy.
- `.symphony/workspaces/<task-id>` is the per-task isolation directory.
- `.symphony/tasks.json` is only a local cache of the last production pull.
- Agent/job telemetry can stay separate from tasks so runtime state does not
  pollute planning state.

## Why Not A Separate Task System

Keeping tasks integrated gives the dashboard and agents the same view of work.
The separate part should be runtime state: workspace path, run attempts, logs,
retry status, and proof of work. That keeps the planning surface simple while
still giving agents a clean execution contract.

## Current MVP

Run the local task reader:

```bash
pnpm symphony
pnpm symphony --commands
pnpm symphony dispatch <task-id-prefix>
pnpm symphony claim <task-id-prefix>
pnpm symphony done <task-id-prefix>
pnpm symphony create "Task title" --description "Details" --project saas-maker --priority high
```

The runner reads your existing Foundry session from `~/.foundry/config.json`,
loads production `/v1/tasks`, writes `.symphony/tasks.json`, and prints the
board grouped by status. Dashboard-created tasks appear locally on the next
`pnpm symphony` run; local `claim`, `done`, `reopen`, `create`, and `delete`
commands write back to production.

The cockpit task board also has a Symphony dispatch action. It copies a Codex
command that:

1. Enters the task's project under `~/Desktop/Fleet`.
2. Creates a deterministic `.symphony/workspaces/<task-id>` directory.
3. Starts Codex with a task prompt built from the task row and `WORKFLOW.md`.
4. Claims `todo` tasks by moving them to `in_progress`.

This keeps the production dashboard and local CLI on the same task store. The
next step is a daemon that polls `/v1/tasks`, enforces concurrency from
`WORKFLOW.md`, and writes run attempts to the existing jobs/activity surface.
