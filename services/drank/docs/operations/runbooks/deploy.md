# Deploy runbook — Cloudflare Pages

drank deploys to Cloudflare Pages as a static export (`out/`) with two
Pages Functions (`/api/dr`, `/api/advisor`). Production deploys are manual
or via CI on push to `main`.

## Manual deploy

```bash
pnpm install --frozen-lockfile
pnpm build          # next build --webpack → out/
pnpm deploy         # build + wrangler pages deploy out --project-name=drank
```

`pnpm deploy` runs build then `wrangler pages deploy out --project-name=drank`.
The project name is fixed in `package.json` and `wrangler.toml`
(`name = "drank"`, `pages_build_output_dir = "out"`).

## CI auto-deploy

`.github/workflows/ci.yml` has a `deploy` job that runs only on push to
`main`, after the `test` job passes:

```yaml
- run: pnpm install --frozen-lockfile
- run: pnpm build
- name: Deploy to Cloudflare Pages
  run: npx wrangler pages deploy out
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

The token must be present in repo secrets as `CLOUDFLARE_API_TOKEN`.

## Custom domain

- Production URL: <https://domains.sassmaker.com>
- The custom domain is wired in the Cloudflare Pages dashboard, not in this
  repo. `app/layout.tsx`, `app/sitemap.ts`, `app/robots.ts`, and the public
  agent surfaces (`public/llms.txt`, `public/api-ai.json`, etc.) all
  hardcode `https://domains.sassmaker.com` as the canonical origin.

## What gets deployed

- `out/` — the full static site (HTML, CSS, JS, favicons, `public/` assets).
- `functions/api/dr.ts`, `functions/api/advisor.ts` — Pages Functions,
  picked up automatically from `functions/` by `wrangler pages deploy`.

## What does NOT get deployed

- `data/*.json` is bundled into the build; the runtime fetch path reads
  the live copy from raw GitHub (see
  [ADR-0005](../../architecture/decisions/0005-dual-data-sources.md)).
- `docs/` and `docs-site/` are not part of the product build. The docs site
  is a separate deploy target (see `docs-site/README.md`).

## Rollback

Cloudflare Pages keeps deployment history. From the dashboard, pick a prior
deployment and "Rollback to this deployment". There is no in-repo rollback
script.

## Things to verify after a deploy

1. <https://domains.sassmaker.com> loads and the LCP shell clears on hydrate.
2. `/api/dr?target=google.com` returns `{domain, dr, fetchedAt}`.
3. `/api/advisor` returns 503 with recovery copy if the gateway is not
   configured (expected on a fresh project); returns advice once configured
   (see [advisor gateway runbook](advisor-gateway.md)).
4. `/llms.txt`, `/index.md`, `/api/ai`, `/sitemap.xml`, `/robots.txt` resolve.
5. `/data` shows the weekly movers table.
