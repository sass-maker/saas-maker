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
  env:
    # Literal values can live in ~/.foundry/config.json symphonyAgentEnv.
    # Secret shell variables can be forwarded with symphonyAgentEnvVars.
  command_templates:
    codex: codex exec --dangerously-bypass-approvals-and-sandbox {prompt}
    claude: claude --dangerously-skip-permissions -p {prompt}
    gemini: gemini --yolo -p {prompt}
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
codex|claude|gemini`, define named profiles in `~/.foundry/config.json`
`symphonyAgentCommands`, add environment through `symphonyAgentEnv` or
`symphonyAgentEnvVars`, or pass `--agent-command` with `{prompt}`,
`{promptFile}`, `{workspace}`, and `{taskId}` placeholders for any other local
agent CLI. Local task sync uses `~/.foundry/config.json` for this account, so
agents do not need a separate production auth flag on this machine. Built-in
Codex, Claude, and Gemini templates run with full local permissions. Agents can
also claim the next available production task locally with `pnpm symphony pick
--agent <profile>`; `pick` selects the highest priority `todo` task, moves it
to `in_progress`, and prints the command to run.
