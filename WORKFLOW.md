---
tracker:
  kind: foundry-tasks
  active_states:
    - Todo
    - In Progress
  terminal_states:
    - Done
polling:
  interval_ms: 30000
workspace:
  root: .symphony/workspaces
agent:
  max_concurrent_agents: 3
  max_turns: 8
  max_retry_backoff_ms: 300000
codex:
  command: codex
---

# Foundry Symphony Workflow

Use the cockpit task list as the tracker. Do not create a separate issue system
unless the task explicitly needs external project-management integration.

For each task:

1. Treat the task title and description as the requested outcome.
2. Use `project_slug` as the target workspace under `~/Desktop/Fleet`.
3. Keep execution isolated under `.symphony/workspaces/<task-id>`.
4. Read the target repository's `AGENTS.md` before editing.
5. Make the smallest coherent change that satisfies the task.
6. Verify with the repository's relevant checks.
7. Report changed files, verification evidence, and remaining risk.

Completion means the task has enough evidence for a human to move it to `Done`.
