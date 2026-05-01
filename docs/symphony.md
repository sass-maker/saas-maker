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
pnpm symphony dispatch <task-id-prefix> --agent claude
pnpm symphony dispatch <task-id-prefix> --agent gemini
pnpm symphony dispatch <task-id-prefix> --agent codex-work
pnpm symphony dispatch <task-id-prefix> --agent-command 'my-agent run --prompt-file {promptFile}'
pnpm symphony pick --agent claude
pnpm symphony pick --agent gemini
pnpm symphony claim <task-id-prefix>
pnpm symphony done <task-id-prefix>
pnpm symphony create "Task title" --description "Details" --project saas-maker --priority high
```

The runner reads your existing Foundry session from `~/.foundry/config.json`,
loads production `/v1/tasks`, writes `.symphony/tasks.json`, and prints the
board grouped by status. Dashboard-created tasks appear locally on the next
`pnpm symphony` run; local `claim`, `done`, `reopen`, `create`, and `delete`
commands write back to production. `pick` chooses the highest-priority `todo`
task, optionally filtered by `--project`, claims it in production, and prints
the selected local agent command.

Local sync does not need a separate login on this machine as long as
`~/.foundry/config.json` has `apiBaseUrl` and `apiKey`. Use `--token` only when
you want to override that account for one command.

The cockpit task board also has a Symphony dispatch action. Pick an agent before
copying the command. Built-in profiles are `codex`, `claude`, and `gemini`, and
they run with full local permissions by default:

- `codex` — `codex exec --dangerously-bypass-approvals-and-sandbox`.
- `claude` — `claude --dangerously-skip-permissions`.
- `gemini` — `gemini --yolo`.

For multiple Codex, Claude, Gemini, or other local profiles, add named command
templates to `~/.foundry/config.json`:

```json
{
  "symphonyAgent": "codex",
  "symphonyAgentEnv": {
    "FOUNDRY_ACCOUNT": "sarthak"
  },
  "symphonyAgentEnvVars": [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY"
  ],
  "symphonyAgentCommands": {
    "codex-work": "codex exec --profile work --dangerously-bypass-approvals-and-sandbox {prompt}",
    "codex-personal": "codex exec --profile personal --dangerously-bypass-approvals-and-sandbox {prompt}",
    "claude-max": "claude --settings ~/.claude/max.json --dangerously-skip-permissions -p {prompt}",
    "gemini-pro": "gemini --yolo -m gemini-2.5-pro -p {prompt}"
  }
}
```

For one-off agents, use a custom command template. Templates support:

- `{prompt}` — inline shell-quoted task prompt.
- `{promptFile}` — path to the generated prompt file.
- `{workspace}` — task workspace path.
- `{taskId}` — production task id.

The copied command:

1. Enters the task's project under `~/Desktop/Fleet`.
2. Creates a deterministic `.symphony/workspaces/<task-id>` directory.
3. Writes `prompt.md` and starts the selected local agent with the task prompt.
4. Claims `todo` tasks by moving them to `in_progress`.

This keeps the production dashboard and local CLI on the same task store. The
next step is a daemon that polls `/v1/tasks`, enforces concurrency from
`WORKFLOW.md`, and writes run attempts to the existing jobs/activity surface.
