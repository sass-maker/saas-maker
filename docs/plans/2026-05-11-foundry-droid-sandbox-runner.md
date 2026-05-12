# Foundry Droid Sandbox Runner

**Date:** May 11, 2026
**Status:** Draft plan
**Goal:** Run SaaS Maker tasks in a Cloudflare Sandbox pod that can be controlled from Cockpit comments, CLI, or shell.

## Principle

One task gets one shared control stream:

- Cockpit comments
- CLI notes
- agent updates
- shell commands
- audit events

The Droid reads that stream, works in a sandbox, and writes progress back to the same task.

## Core Stack

- **Cloudflare Sandbox SDK:** isolated Linux pod for commands, repos, tests, previews, and agents.
- **Custom Sandbox image:** tools only; no repo and no secrets baked in.
- **Task hydration:** clone/restore the repo at task runtime based on project metadata.
- **AI Gateway:** eventual provider switchboard for Claude, Codex, Workers AI, or free-ai.
- **R2:** optional backups, artifacts, and dependency caches.
- **Agents SDK/Durable Objects:** v1 controller for persistent sessions and live state.

## Runner Types

- **Sandbox runner:** disposable Cloudflare pod. Default to one active task per sandbox.
- **Project sandbox:** reusable Cloudflare pod for one repo. Queue tasks if busy; spawn overflow only when needed.
- **Personal runner:** long-running machine over SSH/Tailscale/Termius. Needs health stats, queue, and stronger ops visibility.

## Pod Image

Start with a `basic` Sandbox instance. Preinstall common tools:

- `git`, `gh`, `ripgrep`, `jq`, `curl`, `unzip`, build tools
- `pnpm`, `typescript`, `tsx`
- `uv`, `pytest`, `ruff`
- Claude Code, Codex, and later other agent CLIs

Repos should not be baked into the image. The image is the golden toolbox; the task decides which repo/branch gets plugged into `/workspace`.
Private GitHub repos use an optional `DROID_GITHUB_TOKEN` Worker secret through `GIT_ASKPASS`, so the token is not embedded in the image, clone command, or audit log.

## V0: Current Plan

Build the smallest useful internal runner.

Flow:

1. User starts a run from a Cockpit task or CLI.
2. API creates a `TaskRun`.
3. Sandbox starts from the custom tools image.
4. Droid clones the task repo into `/workspace`.
5. Droid runs a command or agent prompt.
6. Logs and summaries are written back as task events/comments.
7. Before cleanup, Droid captures `git status`, `git diff --stat`, and `git diff --patch` into the audit stream.
8. Final output is a patch summary and test result.

V0 scope:

- fresh sandbox per task
- separate `workers/droid` service
- dummy repo or any selected repo is acceptable for the first proof
- one default agent/tool path
- plain command runner first; agent runner can follow once the pipe works
- command execution
- task comments/events
- internal token auth
- dedicated run/log table so task comments stay clean
- basic audit log backed by the run/log table
- patch artifact rows backed by captured audit events
- no baked repos
- no persistent project workspace yet

V0 auth:

- Store `DROID_INTERNAL_TOKEN` as a Worker secret.
- Clients call Droid with `Authorization: Bearer <token>`.
- Droid rejects missing or mismatched tokens before creating any sandbox.
- Rotate the token by replacing the Worker secret.
- Keep this internal-only until the task/session auth model is ready.

## V1: Target Plan

Turn the runner into a durable task pod.

Add:

- reusable project sandboxes for active repos
- runner routing: reuse idle project sandbox, queue if busy, spawn if none exists
- personal runner support for long-running SSH/Tailscale machines
- runner stats: online/offline, busy/idle, CPU/RAM/disk, queue depth, current task, last heartbeat
- R2 workspace backups and dependency caches
- provider selection through AI Gateway
- `fndroid shell TASK-123`
- pause/resume/approve controls
- Cockpit Droid tab with logs, terminal, changed files, and actions
- PR creation or deployment based on task level
- broader trusted-mode permissions for internal fleet tasks

Trusted mode can allow edit, push, deploy, and release when the task level grants it. Because permissions are broad, audit logging is mandatory.

### V1b Agent Runner

Use Claude Code as the first agent shell, with DeepSeek as the Anthropic-compatible model backend:

- install `@anthropic-ai/claude-code` in the Droid image
- store the DeepSeek key as `DROID_DEEPSEEK_API_KEY`
- inject DeepSeek env vars only at runtime, never in the image or run logs
- run Claude Code headlessly with `claude -p <prompt>`
- keep command mode as the fallback path when no model key is configured

DeepSeek env shape:

```bash
ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
ANTHROPIC_AUTH_TOKEN=<DeepSeek API key>
ANTHROPIC_MODEL=deepseek-v4-pro[1m]
ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro[1m]
ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-pro[1m]
ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash
CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash
CLAUDE_CODE_EFFORT_LEVEL=max
```

Future image work: split the current large image into a lean command image and a heavier agent image. Keep the lean image for V1a command runs; use the agent image only when Claude Code/OpenCode/etc. are needed.

## Missing Pieces From Stripe-Style Minions

These belong mostly in V2, after V0 proves execution and V1 makes the runner usable day to day:

- **Blueprints:** workflow steps in code. Deterministic steps run git, lint, tests, CI, PR/deploy; agent steps handle ambiguous code changes.
- **Tool registry:** SaaS Maker MCP/API tools for tasks, docs, project metadata, GitHub, CI, deploys, and logs. Expose only the tools needed for the task.
- **Context preflight:** hydrate the prompt with task comments, linked docs, project metadata, `AGENTS.md`, recent failures, and relevant files before the agent starts.
- **Fast local checks:** run the smallest lint/type/test checks before CI.
- **Retry budget:** cap automated CI/test repair loops, then return to the user with a clear failure summary.
- **Scoped rules:** apply repo/subdirectory-specific guidance, not one giant global prompt.
- **Review gate:** PRs are human-reviewed by default; deploys require task-level permission.

## Version Split

- **V0 = execution:** launch a sandbox, hydrate repo, run command/agent, stream logs, write final summary.
- **V1 = workflow UX:** reusable/project/personal runners, queueing, shell attach, runner stats, provider choice, PR/deploy actions.
- **V2 = reliability/governance:** blueprints, scoped tools, context preflight, fast checks, retry budgets, review gates, risk scoring, run metrics.

## CLI Shape

```bash
fndroid run TASK-123 "fix the failing tests"
fndroid note TASK-123 "start with auth middleware"
fndroid logs TASK-123
fndroid shell TASK-123
fndroid pause TASK-123
fndroid resume TASK-123
fndroid approve TASK-123
```

## Local Dev Shape

When running Cockpit locally, use a local API Worker too:

```bash
LOCAL_AUTH_BYPASS=true pnpm -F @saas-maker/api dev --port 8787
LOCAL_AUTH_BYPASS=true NEXT_PUBLIC_API_URL=http://localhost:8787 DROID_API_URL=https://saasmaker-droid.sarthakagrawal927.workers.dev DROID_INTERNAL_TOKEN=<droid-token> pnpm --dir apps/cockpit exec next dev --webpack --port 3001
```

Do not point local Cockpit at production API with `local-dev-session`; production will reject it. Local Cockpit and local API should both run with `LOCAL_AUTH_BYPASS=true`.

Normal local Cockpit pages should not require an extra local token. Run-capable local endpoints can still be protected separately.

## Audit Log

Every command should record:

- actor and source
- command and working directory
- start/end timestamps
- exit code
- stdout/stderr pointer or excerpt
- changed file summary when available

Cockpit shows summaries by default and keeps raw command history inspectable.

## Pricing Choice

Fresh sandbox per task:

- cheaper and safer for rare work
- repeats clone/install/context cost
- best for V0

Reusable project sandbox:

- faster for frequent work on the same repo
- reuses checkout, dependencies, cache, and context
- only costs more if kept awake
- best for V1 once cleanup/audit flows exist

With the current $5 Workers Paid plan, a `basic` container has roughly 25 included running hours per month. Reusable sandboxes are viable if they sleep when idle.

This is not a 2,500 wall-hour allowance. The included container usage is 25 GiB-hours of memory, 375 vCPU-minutes of active CPU, and 200 GB-hours of disk per month. A `basic` container has 1 GiB memory, so memory alone maps to about 25 running hours before overage. A `lite` container has 256 MiB memory, so memory maps to about 100 running hours.

## Output Policy

- Small code tasks: raise a PR.
- Deployment tasks: deploy if the task level grants deploy permission.
- Ambiguous tasks: produce patch/test summary and ask for the next action.
