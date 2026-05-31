# Laptop Service Backup - 2026-05-31

Branch: `backup/laptop-service-20260531`

Purpose: preserve local SaaS Maker fleet-secret audit work before the laptop
goes in for service.

Included changes:

- `AGENTS.md`
- `scripts/fleet-secret-audit.mjs`
- `scripts/lib/fleet-secret-audit.mjs`
- `tests/scripts/fleet-secret-audit.test.ts`
- `docs/cloudflare-secret-management.md`

Observed scope:

- Fleet secret audit logic and tests.
- Cloudflare secret-management documentation.
- Agent guidance update.

Not included:

- `cloudflare.targets.json` because it may contain local target or account
  configuration.
- No secrets or environment files.
- No deploy or migration.

