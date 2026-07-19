Run the daily Foundry fleet health sentinel from /Users/assistant/Desktop/fleet/saas-maker.

Style:
- Be very concise. Report only real regressions, task changes, skipped checks, blockers.
- Use agents only for tiny independent remediation with clear acceptance; otherwise this is read-mostly.

Rules:
- Lightweight daily health check, not product review or cleanup pass.
- No deploys, migrations, secret/env/cloud credential edits, commits, pushes, merges, releases, or destructive commands.
- Preserve dirty user work.

Flow:
1. Run `pnpm symphony --json --no-cache` to avoid duplicates.
2. Run `pnpm fleet:prod-smoke -- --timeout-ms 45000`; read latest artifacts.
3. Run `pnpm fleet:monitoring-audit -- --json`; summarize failures only.
4. Check latest default-branch GitHub Actions failures with `gh` where available.
5. Label stale/project-scoped/network-blocked results clearly; do not treat them as product regressions.
6. Create/update tasks only for new real regressions. Mark access/config/deploy tasks blocked_on_user=true.

Output:
- Very concise: regressions, tasks changed, skipped checks, what needs Sarthak.
- Include commands/artifact paths, not raw logs.

