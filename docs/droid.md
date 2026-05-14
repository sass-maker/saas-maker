# Droid

Droid is the SaaS Maker task runner. From Cockpit Tasks, it can start a Cloudflare Sandbox, hydrate a repo, run command or native-agent work, record audit events, run an optional acceptance command, and open a draft PR.

## Quick Start

1. Create or open a task in Cockpit.
2. Click **Droid**.
3. Confirm the repo URL, target branch, prompt, and optional working directory.
4. Add an acceptance command such as `pnpm test` or choose a suggested one.
5. Run Droid and watch the Result, Acceptance, Artifacts, and Events panels.

Droid queues work by repo/project. If a run is already active for that repo, the next run waits instead of starting a parallel sandbox.

## Run Request

Cockpit calls the Droid Worker with:

```json
{
  "task_id": "task-id",
  "project_slug": "saas-maker",
  "mode": "native",
  "prompt": "Work on this task...",
  "repo_url": "https://github.com/org/repo.git",
  "branch": "main",
  "cwd": "",
  "create_pr": true,
  "pr_title": "Droid: task title",
  "acceptance_command": "pnpm test",
  "acceptance_timeout_seconds": 300
}
```

Key fields:

- `mode`: `native` for the DeepSeek-backed Droid runner, or `command` for a shell command.
- `repo_url`: repo to clone into the sandbox.
- `branch`: base branch for hydration and PR creation.
- `cwd`: optional subdirectory used for work and acceptance.
- `create_pr`: when true, Droid requires a meaningful patch, review gate, acceptance pass if configured, and then opens a draft PR.
- `acceptance_command`: optional command Droid runs before a draft PR is created.
- `acceptance_timeout_seconds`: clamped to 30-900 seconds.

## Output

Droid stores:

- run status, exit code, duration, summary, and error message in `droid_runs`
- command, agent, queue, acceptance, PR gate, and final report events in `droid_run_events`
- patch and acceptance references in `droid_run_artifacts`

The final report event is machine-readable and includes `summary`, `files_changed`, `checks_run`, `pr_url`, `blockers`, and `risks`.
