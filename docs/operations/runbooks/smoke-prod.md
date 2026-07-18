# Runbook: Production Smoke

Verify the SaaS Maker production surfaces are healthy. Source:
[`../../../scripts/smoke-prod.mjs`](../../../scripts/smoke-prod.mjs).

## Post-deploy smoke (single project)

```bash
pnpm smoke
```

Runs 7 prod HTTP checks against `api.sassmaker.com` and `app.sassmaker.com`:

1. API `/health` returns 200.
2. CORS headers are present and allowlisted.
3. Auth rejection (no token) returns 401.
4. Cockpit `/login` loads.
5. Cockpit `/projects` redirects when unauthenticated.
6. Sign-in/social returns the Google OAuth URL.
7. Bundled Cockpit JS does not contain `localhost:8787` (catches local-build
   leaks).

This is wired into both `pnpm -F @saas-maker/api run deploy` and
`pnpm -F @saas-maker/dashboard run deploy`. **A failed smoke = a bad release.**

## Fleet-wide production smoke

```bash
pnpm fleet:prod-smoke -- --timeout-ms 45000
pnpm fleet:prod-smoke -- --timeout-ms 45000 --screenshot-all
```

Iterates every fleet project's known prod URL. Results land under
`.symphony/fleet-production-smoke/<project>/latest.md`.

## Interpreting failures

- **Project-scoped failure**: one project down, fleet healthy → file a Symphony
  task for that project, do not page.
- **Network-blocked / stale**: the runner could not reach the URL or the result
  is older than expected → label clearly, do not treat as a product regression.
- **Auth-endpoint failure across multiple projects**: likely a shared
  dependency (better-auth, D1) → escalate immediately.
- **Cockpit JS contains `localhost:8787`**: a local build was deployed to prod
  → roll back the cockpit deploy and rebuild from clean CI.

## Optional Chromium warnings

Chromium's optional YouTube `compute-pressure` permissions warning is
classified as non-fatal (see LoopTV smoke). Do not fail a run for it.
