# Foundry Reusable Workflows

Foundry exposes `workflow_call`-style GitHub Actions that any Fleet repo can `uses:` directly. Pin via the published tag (e.g. `@v1`) once the parent repo is tagged.

## `foundry-cf-deploy.yml@v1`

End-to-end Cloudflare deploy with optional post-deploy smoke check.

### Consume

```yaml
# .github/workflows/deploy.yml in your project repo
name: Deploy
on:
  push:
    branches: [main]
jobs:
  cf:
    uses: sarthakagrawal927/saas-maker/.github/workflows/foundry-cf-deploy.yml@v1
    with:
      worker_name: my-api
      wrangler_config_path: wrangler.toml
      smoke_url: https://api.example.com/health
    secrets: inherit
```

### Inputs

| Input | Default | Notes |
|---|---|---|
| `worker_name` | required | Used in step names + logs |
| `wrangler_config_path` | `wrangler.toml` | Path to wrangler config |
| `working_directory` | `.` | Useful for monorepos |
| `node_version` | `20` | |
| `pnpm_version` | `10` | |
| `build_command` | `pnpm build` | Set `''` to skip |
| `dry_run` | `false` | When true, runs `wrangler deploy --dry-run` |
| `smoke_url` | `''` | Hits this URL after deploy and expects 2xx |
| `smoke_max_attempts` | `12` | Retry count, 5s between attempts |

### Required secrets

- `CLOUDFLARE_API_TOKEN` — required
- `CLOUDFLARE_ACCOUNT_ID` — required only if your wrangler config doesn't pin it

Pass them via `secrets: inherit` from the consuming workflow.

## `foundry-smoke.yml@v1`

Standalone post-deploy smoke + accessibility audit. Use after any deploy:

```yaml
jobs:
  smoke:
    uses: sarthakagrawal927/saas-maker/.github/workflows/foundry-smoke.yml@v1
    with:
      url: https://app.example.com
      a11y: true
```

See [foundry-smoke.yml](./foundry-smoke.yml) for the full input list.
