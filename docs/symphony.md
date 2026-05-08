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

Local sync shells out through the Foundry CLI. Run `fnd login` once for this
machine/account; Symphony does not accept or pass API keys directly.

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
    "CLAUDE_CONFIG_DIR",
    "CODEX_HOME"
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

## Fleet failure importer

`scripts/fleet-failure-import.mjs` turns recent fleet GitHub failures into
Symphony tasks instead of relying on manual sweeps.

```bash
# Dry-run (default, never writes): scan first 5 projects, show payloads.
node scripts/fleet-failure-import.mjs --dry-run --limit 5

# Limit to one project, emit JSON for piping.
node scripts/fleet-failure-import.mjs --project saas-maker --json

# Include non-main branch failures only when deliberately needed.
node scripts/fleet-failure-import.mjs --all-branches --json

# Real write - upserts via scripts/symphony-local.mjs create.
node scripts/fleet-failure-import.mjs --write
```

It reads `foundry.projects.json`, calls `gh run list --json ... --branch main`
per repo by default, evaluates the newest run per workflow, keeps only surfaces
whose current state is failing (`failure`, `timed_out`, `startup_failure`,
`cancelled`), dedupes by `${project}::${surface}`, and builds task payloads
with explicit acceptance criteria and run links. It dedupes against
`.symphony/tasks.json` by exact title so re-runs stay idempotent.

Pure parsing/dedupe/payload helpers live in
`scripts/lib/fleet-failure-importer.mjs` and are unit tested in
`tests/scripts/fleet-failure-importer.test.ts`; tests never shell out to
`gh`.
