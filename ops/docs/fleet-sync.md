# Fleet Sync Guard

The public portfolio/directory contract lives in
`fleet-ops/config/spotlight-products.json`. The target map is in
`fleet-ops/config/spotlight-sync.json`.

Run the local check from the Fleet root:

```bash
node fleet-ops/scripts/sync-spotlight-products.mjs --check
```

Use `--write` only when intentionally regenerating the machine-owned portfolio
data and SaaS Maker spotlight fields. Profile README content remains
product-owned and is reported as drift rather than overwritten.

The root `Fleet Sync Guard` workflow checks the portfolio, SaaS Maker, personal
profile, and organization profile repositories on relevant pull requests and
pushes to `main`, then runs a daily reconciliation. It uses `--strict`, so a
missing checkout or stale canonical URL fails with the target name.

This is metadata/public-surface synchronization. Application code, CI, and
Cloudflare deployments remain independently owned; use `git-health.sh` and
`deploy-health.sh` for repository/deployment reconciliation.
