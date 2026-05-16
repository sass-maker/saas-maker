# Droid Roadmap

Droid is usable as an experimental v1 runner: it can start a Cloudflare Sandbox, hydrate a repository, run work, capture audit events, and raise a draft PR. The next work is about making it reliable enough to trust without hand-holding.

## Next Tasks

1. Runner contract
   - Define a provider interface for command, native DeepSeek, OpenCode, Codebuff, Codex, Claude Code, and future backends.
   - Require streaming or heartbeat events from every provider.
   - Treat buffered CLIs as unreliable unless wrapped by a parent watcher.

2. Completion and idle semantics
   - Add an explicit completion marker for agent prompts.
   - Stop early when the marker or structured final response appears.
   - Track last output time separately from hard run timeout.

3. Stuck-run recovery
   - Add a timeout policy for runs with no events.
   - Auto-cancel or mark stale runs failed.
   - Release the repo queue when a run is stale.

4. Runner observability
   - Show active run, queue depth, sandbox id, duration, last event, and failure reason in Cockpit.
   - Add a compact stats endpoint for Droid health.

5. Better PR quality gate
   - Require changed-file summary, patch review result, and optional acceptance command output before PR creation.
   - Keep PRs draft by default.
   - Add a clear failure summary when no meaningful diff is produced.

6. Safer task context
   - Hydrate Droid prompts with task title, comments, project metadata, repo guidance, and acceptance criteria.
   - Support prompt templates with safe variables such as task id, source branch, target branch, project slug, and acceptance criteria.
   - Keep secrets out of logs and prompts.

7. Task feedback loop
   - Let Droid post agent comments back to `/v1/tasks/:id/comments`.
   - Let Droid mark a task `blocked_on_user` when it needs credentials, config, or a product decision.
   - Include the blocker reason, run id, last command, changed-file summary, and exact question for the user.
   - Use a scoped SaaS Maker service or CLI token stored as a Droid Worker secret.
   - Keep raw command logs in Droid run events; keep task comments concise.

8. Branch and workspace policy
   - Use explicit Droid branches for every PR-capable run.
   - Preserve dirty workspaces on failure when possible.
   - Clean up successful clean workspaces automatically.

9. Multi-step run plans
   - Split larger jobs into implement, review, and fix phases.
   - Reuse the same sandbox/workspace across those phases.
   - Record per-phase outputs and checks.

10. Model and tool routing

- Keep command mode as the fallback.
- Add configurable agent backends.
- Test Codebuff, OpenCode, and the custom runner against the same task fixture.

11. Structured outputs

- Require final agent output to include machine-readable summary, files changed, tests run, risks, and next action.
- Validate that payload before PR creation.

12. Cost controls

- Track sandbox duration, vCPU seconds, memory hours, disk hours, and egress per run.
- Surface estimated cost in the run summary.

13. Production controls

- Add task-level permissions for edit, push, PR, deploy, and release.
- Require an explicit deploy/release decision when the task asks Droid to cross that boundary.
- Add audit-log search and export.

## Sandcastle Ideas To Borrow

[Sandcastle](https://github.com/mattpocock/sandcastle) is a useful reference for Droid because it focuses on orchestrating coding agents rather than being another agent. Relevant ideas:

- Provider abstraction: sandbox runtime and agent runtime should be pluggable.
- Line-by-line event streaming: this powers live logs and idle timeout detection.
- Explicit branch strategy: head, merge-to-head, or named branch. Droid should default to named PR branches.
- Reusable sandbox: run implement and review agents in the same workspace before opening a PR.
- Lifecycle hooks: separate setup steps from the agent prompt.
- Prompt templates: support safe variables and controlled context expansion.
- Completion signal: stop the loop early when the agent proves it is done.
- Structured final output: parse a tagged JSON result before deciding whether to PR.
- Abort and cleanup: preserve dirty workspaces after failure; clean up when safe.

Do not vendor Sandcastle for Droid v1. Borrow the architecture and contracts, then add a Cloudflare Sandbox provider only if the custom runner starts duplicating too much orchestration code.

## Definition Of Hands-Off

Droid becomes a hands-off production employee when it can:

- pick up a task from Cockpit
- create a meaningful patch without manual intervention
- run the smallest relevant checks
- produce a draft PR with audit logs and test output
- comment back on the task when it needs help
- mark the task blocked when a concrete decision or missing config is required
- recover or fail clearly when stuck
- avoid leaking secrets
- show cost and runtime stats for the run
