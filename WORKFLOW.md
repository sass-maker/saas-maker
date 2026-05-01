---
tracker:
  kind: foundry-tasks
  source: https://api.sassmaker.com/v1/tasks
  local_cache: .symphony/tasks.json
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
  default: codex
  command_templates:
    codex: codex {prompt}
    claude: claude -p {prompt}
    gemini: gemini -p {prompt}
  custom_command_placeholders:
    - "{prompt}"
    - "{promptFile}"
    - "{workspace}"
    - "{taskId}"
  max_concurrent_agents: 3
  max_turns: 8
  max_retry_backoff_ms: 300000
---

# Foundry Symphony Workflow

Use the production cockpit task list as the tracker. `pnpm symphony` pulls the
same production `/v1/tasks` data into `.symphony/tasks.json`; local task status
changes must be pushed back through the API rather than edited only in the
cache. Do not create a separate issue system unless the task explicitly needs
external project-management integration.

For each task:

1. Treat the task title and description as the requested outcome.
2. Use `project_slug` as the target workspace under `~/Desktop/Fleet`.
3. Keep execution isolated under `.symphony/workspaces/<task-id>`.
4. Read the target repository's `AGENTS.md` before editing.
5. Make the smallest coherent change that satisfies the task.
6. Verify with the repository's relevant checks.
7. Report changed files, verification evidence, and remaining risk.

Completion means the task has enough evidence for a human to move it to `Done`.
Symphony dispatch is agent-agnostic: use `pnpm symphony dispatch <id> --agent
codex|claude|gemini`, or pass `--agent-command` with `{prompt}`,
`{promptFile}`, `{workspace}`, and `{taskId}` placeholders for any other local
agent CLI. Agents can also claim the next available production task locally with
`pnpm symphony pick --agent codex|claude|gemini`; `pick` selects the highest
priority `todo` task, moves it to `in_progress`, and prints the command to run.
