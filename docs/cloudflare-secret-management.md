# Fleet Cloudflare Secret Management

SaaS Maker owns the fleet-level audit of Cloudflare deployment state. Repos still
own their actual secret values and local `.env` files.

## Source of truth

`cloudflare.targets.json` lists Cloudflare targets by project:

- target type: Worker or Pages
- Wrangler config path
- required Cloudflare secrets
- required Wrangler vars
- required bindings

The file stores names only. Do not put secret values, tokens, account secrets, or
private environment files in this manifest.

## Audit

Run:

```bash
pnpm fleet:secret-audit
pnpm fleet:secret-audit -- --json
pnpm fleet:secret-audit -- --project reader --fail-on-missing
pnpm fleet:secret-audit -- --project rag-service --fail-on-missing
```

The audit checks:

- GitHub Actions deploy secrets and public deploy variables
- Cloudflare Worker secrets
- Cloudflare Pages secrets
- Wrangler-declared vars
- Wrangler-declared bindings

It does not write secrets or print secret values.

## Updating a project

When adding or changing a Cloudflare app:

1. Add or update the repo's `wrangler.toml` or `wrangler.jsonc`.
2. Add the target to `cloudflare.targets.json`.
3. Put runtime secret values directly in Cloudflare with Wrangler or the
   dashboard.
4. Put deploy credentials in the repository's GitHub Actions secrets/variables.
5. Run `pnpm fleet:secret-audit -- --project <slug> --fail-on-missing`.

For the standalone RAG service, the expected final runtime blocker is only the
Worker secret name:

```bash
cd ../rag-service
pnpm exec wrangler secret put RAG_SERVICE_KEYS
RAG_SERVICE_KEY=<service-key> pnpm run readiness:auth
cd ../saas-maker
pnpm fleet:secret-audit -- --project rag-service --fail-on-missing
```

Keep health contracts separate from deployment state. Health contracts describe
what production should do; `cloudflare.targets.json` describes what Cloudflare
must have configured for that production target to run.
