# Foundry Symphony

Foundry Symphony is the task-backed orchestration layer for this repository.
It follows the OpenAI Symphony shape, but uses the existing cockpit task list as
the tracker instead of adding a separate issue board.

Fleet-level operating instructions live in the local workspace at
`../../docs/fleet-runbook.md`. The cross-system map lives in
`../../docs/project-map.md`. On GitHub, those shared docs are in
`sarthakagrawal927/fleet-workspace`. Keep this document focused on Symphony
behavior inside SaaS Maker.

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
pnpm symphony dispatch <task-id-prefix> --agent auto
pnpm symphony dispatch <task-id-prefix> --agent claude
pnpm symphony dispatch <task-id-prefix> --agent gemini
pnpm symphony dispatch <task-id-prefix> --agent grok
pnpm symphony dispatch <task-id-prefix> --agent codex-work
pnpm symphony dispatch <task-id-prefix> --agent-command 'my-agent run --prompt-file {promptFile}'
pnpm symphony pick --agent claude
pnpm symphony pick --agent gemini
pnpm symphony usage
pnpm symphony:agent-usage --refresh
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

Tasks can also carry branch, commit, pull request, and deployment lifecycle
fields. Cockpit shows those fields inline on each task so a task can move from
local execution to PR review to deployed verification without losing the link
between the work request and the shipped artifact.

Tasks can be marked `blocked_on_user` when they need a decision, credential,
answer, or review from Sarthak before an agent should run them. Cockpit treats
those tasks as blocked for dispatch and batch runs. Add a task comment with
`resolves_blocker` to clear the blocker while preserving the answer in the task
history. If the comment is the final confirmation, add `marks_done` as well;
the task moves to `done`, clears `blocked_on_user`, and keeps the confirmation
attached to the task page. Add `sync_to_description` when the decision or
handoff should also appear in the task list preview for shared visibility.

Local sync shells out through the Foundry CLI. Run `fnd login` once for this
machine/account; Symphony does not accept or pass API keys directly.

Marketing tasks should add ideas directly to the SaaS Maker Marketing Queue,
not only to repo docs. Use a session-auth API call like:

```bash
fnd api POST /v1/marketing/posts --auth session --body '{"project_slug":"linkchat","channel":"x","status":"generated","source_type":"task","source_id":"<task-id>","task_id":"<task-id>","title":"Short idea title","hook":"Plain hook","body":"Post body","cta":"Try it and send feedback."}'
```

The review flow is `generated` → `accepted` or `rejected`; accepted ideas move
to `sent` after posting. Repo files under `docs/marketing/` are optional source
notes, not the system of record for publishable ideas.

The cockpit task board also has a Symphony dispatch action. By default it uses
auto routing: task metadata and `.symphony/agent-usage.json` decide whether the
run goes to Codex, Claude, Gemini, Grok, or Cursor. Built-in profiles are `auto`, `codex`,
`claude`, `claude-work`, `gemini`, `grok`, and `cursor`; the concrete execution profiles run with full local
permissions by default:

- `auto` — choose `codex`, `claude`, `gemini`, `grok`, or `cursor` from task shape plus recent usage.
- `codex` — `codex exec --dangerously-bypass-approvals-and-sandbox`.
- `claude` — `claude --dangerously-skip-permissions -p ... --output-format json --no-session-persistence`.
- `claude-work` — `CLAUDE_CONFIG_DIR="$HOME/.claude-work" claude --dangerously-skip-permissions -p ... --model ${SYMPHONY_CLAUDE_WORK_MODEL:-sonnet} --output-format json --no-session-persistence`.
- `gemini` — `gemini --yolo -p ... --output-format json --skip-trust`.
- `grok` — `grok --permission-mode bypassPermissions --prompt-file ... --output-format json --no-alt-screen`.
- `cursor` — `agent --print --force --trust --output-format json`.

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

## Agent Usage Sampling

Symphony does not currently get a clean remaining-quota API from Claude or
Gemini CLI. Instead, use a short-lived local cache built from low-risk probe
runs and actual run output:

```bash
pnpm symphony:agent-usage
pnpm symphony:agent-usage --refresh
pnpm symphony:agent-usage --json
```

The sampler writes `.symphony/agent-usage.json`. Claude probes use
`--permission-mode plan`, `--output-format json`, `--no-session-persistence`,
and a small `--max-budget-usd`; Gemini probes use `--approval-mode plan`,
`--output-format json`, and `--skip-trust`. The router should treat this as a
freshness-based signal, not an exact quota API: refresh it before a batch, after
a few delegated tasks, or whenever an agent returns a budget/rate-limit error.
Task dispatches do not add a default Claude spend cap; use `pnpm symphony usage`
or `pnpm symphony usage --refresh` to inspect current usage signals before
routing larger batches.

Local cockpit dispatch wraps each started command with
`scripts/symphony-agent-exec.mjs`. The wrapper writes:

- `.symphony/runs/<task-id>-<run-id>.log` — combined stdout/stderr.
- `.symphony/runs/<task-id>-<run-id>.json` — exit status, output tails, parsed
  CLI JSON, and parsed usage.

When Claude, Claude Work, or Gemini emits JSON usage, the wrapper updates
`.symphony/agent-usage.json` so future auto routes learn from real task runs,
not only probes. The run ledger stores the log path in `log_hint`.

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

## Fleet weekly workflow normalizer

Use the normalizer before sweeping failures when the noisy surface is
`.github/workflows/weekly.yml` drift. It checks each local fleet repo and only
rewrites the caller workflow when `--write` is passed.

```bash
pnpm symphony:normalize-weekly --json
pnpm symphony:normalize-weekly --write --project anime_list
```
