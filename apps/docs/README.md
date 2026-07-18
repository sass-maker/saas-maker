# Docs App — DEPRECATED (pending removal)

> **⚠️ DEPRECATED.** This legacy Astro/Starlight docs site (`docs.sassmaker.com`)
> has been **superseded by the Blume docs** served at
> **[sassmaker.com/docs](https://sassmaker.com/docs)**.
>
> The canonical docs are now the Markdown tree at the repo root (`docs/`),
> rendered by `apps/docs-blume/` (Blume) and folded into the apex site's build
> — `apps/showcase` copies the Blume output into `dist/docs/`, so
> `sassmaker.com/docs` is served by the existing `saas-maker-home` CF Pages
> project. See the merge step in `apps/showcase/scripts/merge-blume-docs.mjs`.
>
> **This app is pending removal.** Do not add content here; edit `docs/` instead.
>
> ### Retirement steps (remaining)
>
> 1. **CF dashboard (human step):** retire / delete the separate
>    `saas-maker-docs` Cloudflare Pages project that serves
>    `docs.sassmaker.com` (its deploy is dashboard/git-connected, not
>    configured in-repo).
> 2. **301 redirect:** point `docs.sassmaker.com/*` →
>    `https://sassmaker.com/docs` at the Cloudflare dashboard (bulk redirect
>    rule or a redirect-only Pages/Worker), so old links keep resolving after
>    this project is removed. This repo's `public/_redirects` also carries a
>    catch-all 301 as a fallback for as long as the project still deploys.
> 3. Once (1) and (2) are live and verified, this `apps/docs` app can be
>    deleted wholesale in a follow-up change.

Astro Starlight docs for Foundry.

## Commands

Run from the repo root:

| Command | Action |
| :------ | :----- |
| `pnpm -F @saas-maker/docs dev` | Start the docs app locally |
| `pnpm -F @saas-maker/docs build` | Build the static docs site |
| `pnpm -F @saas-maker/docs preview` | Preview the production build |

The docs build also regenerates `public/llms.txt` before output.

## Important Files

- `astro.config.mjs` — Starlight config and sidebar
- `src/content/docs/` — markdown content for docs pages
- `public/openapi.json` — published OpenAPI artifact consumed by the docs site
- `scripts/generate-llms-txt.mjs` — builds `public/llms.txt`
