# Droid

Droid is the SaaS Maker task runner. From Cockpit Tasks, it can start a Cloudflare Sandbox, hydrate a repo, run command or native-agent work, record audit events, run optional command/browser acceptance, and open a draft PR.

## Quick Start

1. Create or open a task in Cockpit.
2. Click **Droid**.
3. Confirm the repo URL, target branch, prompt, and optional working directory.
4. Add an acceptance command such as `pnpm test` or choose a suggested one.
5. Optionally enable Browser test to capture a Cloudflare Browser Run screenshot.
6. Run Droid and watch the Result, Acceptance, Browser, Artifacts, and Events panels.

Droid queues work by repo/project. If a run is already active for that repo, the next run waits instead of starting a parallel sandbox. Different repos can run in parallel until the global `DROID_MAX_RUNNING_RUNS` cap is reached; the default cap is `3`.

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
  "acceptance_timeout_seconds": 300,
  "browser_acceptance": {
    "enabled": true,
    "goal": "Verify the task flow works in the UI",
    "url": "https://preview.example.com/tasks",
    "assert_text": ["Droid", "Events"],
    "keep_open": true
  }
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
- `browser_acceptance`: optional Cloudflare Browser Run check. Use `url` for an existing preview/deploy URL, or `start_command` + `port` + `preview_hostname` to start an app inside the sandbox and expose it.

Droid native prompts are hydrated before the agent starts. The bundle includes
the task id/title/description, project slug, repo URL, branch, recent task
comments from Cockpit, git status, top-level repo files, `AGENTS.md`, and
package scripts when present. This gives the agent enough context to continue a
comment thread without stuffing raw logs or secrets into the prompt.

For a cheap smoke test against an existing public URL, run command mode with `command: "browser_acceptance"` and `browser_acceptance.url`. Droid skips sandbox startup for that case and only records Browser Run events/artifacts.

## Output

Droid stores:

- run status, exit code, duration, summary, and error message in `droid_runs`
- command, agent, queue, acceptance, browser, PR gate, and final report events in `droid_run_events`
- patch, acceptance, and browser screenshot references in `droid_run_artifacts`

Browser screenshots are stored as small JPEG data URIs for V0 visibility. If `keep_open` is true, the Browser Run session stays alive briefly so it can also be inspected from Cloudflare Browser Run Live Sessions.

The final report event is machine-readable and includes `summary`, `files_changed`, `checks_run`, `pr_url`, `pr_branch`, `next_action`, `blockers`, and `risks`.

## Task Feedback

When `DROID_SAASMAKER_TOKEN` is configured, Droid can write back to the task:

- block actions add an agent comment and set `blocked_on_user`
- final reports add a concise run summary comment
- draft PR creation updates `pr_url`, `pr_status`, and `branch_name`

## Reliability

Droid exposes `POST /v0/runs/reap-stale` for cron/manual cleanup. It finds running jobs with no activity for 15 minutes, marks them failed, cancels the sandbox when possible, and releases the next queued run for that repo/project.

## Permissions And Audit

Droid treats task runs as edit-and-PR capable by default, not deploy capable.
The current permission model is:

- `edit`: allowed inside the sandbox workspace for every run.
- `shell`: allowed only through recorded Droid command/tool events.
- `push` and `pr`: allowed only when `create_pr` is true, a meaningful diff is captured, and configured acceptance gates pass.
- `deploy` and `release`: not executed by Droid. Create a task blocker or draft PR for user/Codex approval instead.

Every command, provider choice, queue event, patch capture, acceptance result,
browser check, PR attempt, and final report is written to Droid run tables.
Task comments stay concise: final summaries, draft PR links, blockers, and exact
questions only.
