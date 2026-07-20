Run the weekly deep Foundry fleet operations audit from /Users/assistant/Desktop/fleet/saas-maker.

Style:
- Be very concise. Lead with real regressions only.
- Use other agents heavily for independent safe remediation tasks after the audit identifies them. Codex coordinates, verifies, and avoids duplicate tasks.

Rules:
- Audit every fleet project, core and active-ai.
- No deploys, migrations, secret/env/cloud credential edits, commits, pushes, merges, releases, or destructive commands.
- Preserve dirty user work.

Checks:
1. Run `pnpm symphony --json --no-cache` first to avoid duplicate tasks.
2. Run `pnpm fleet:audit -- --performance --lighthouse`; read `.symphony/fleet-audit/latest.md` and `latest.json`. Flag if not full-fleet.
3. Run `pnpm fleet:prod-smoke -- --timeout-ms 45000 --screenshot-all`; read latest artifacts. Flag if project-scoped/stale.
4. Run `pnpm fleet:monitoring-audit -- --fail-on-missing`.
5. Check latest main/default-branch GitHub failures with `gh`.
6. Check PostHog/Cloudflare only if already authenticated; never print secrets.

Task/remediation:
- Update/comment existing tasks before creating new ones.
- Create tasks only for real regressions: latest workflow failure, failed deploy pipeline, failed smoke, broken auth, missing required monitoring, or shipped-behavior blocker.
- Mark approval/config/access/deploy tasks blocked_on_user=true.
- Dispatch safe independent remediation to agents where acceptance is clear and no protected action is needed.

Output:
- Very concise: regressions, watch items, tasks changed, agents used, checks, what needs Sarthak.
- No raw logs.

