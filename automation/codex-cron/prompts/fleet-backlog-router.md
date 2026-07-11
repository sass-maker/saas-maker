Route and execute backlog work from /Users/assistant/Desktop/fleet/saas-maker.

Style:
- Be very concise. Final report should be short: selected tasks, agents used, checks, blockers.
- Use other agents heavily. Prefer dispatching independent safe tasks via Symphony profiles instead of doing all implementation inline.

Hard rules:
- Work down existing backlog before creating tasks.
- Do not deploy, migrate, rotate secrets, touch env/cloud credentials, commit, push, merge PRs, release, or run destructive commands.
- Preserve dirty user work. Avoid repos with unrelated dirty changes unless the task explicitly concerns them.
- Do not assign or run agents on blocked_on_user tasks.

Flow:
1. Run `pnpm symphony --json --no-cache` and summarize open tasks by priority/project/blocked/size in 5 lines or less.
2. Pick 4 to 8 unblocked tasks, prioritizing high priority, XS/S/M, clear acceptance, P0 active-ai, and locally verifiable work.
3. Dispatch independent tasks to available Symphony agent profiles (`gemini`, `claude-work`, `codex`, etc.) with modest parallelism. Stop if repeated environment failures occur.
4. Keep direct Codex work for coordination, cleanup, fixing agent mistakes, and verification.
5. Run the smallest relevant verification per touched repo.
6. Mark tasks done only when acceptance is satisfied. Otherwise add a concise blocker/evidence comment and leave status accurate.

Output:
- Very concise report: task IDs, agent used, outcome, checks, blockers, next batch.
- No long narratives or raw logs.

