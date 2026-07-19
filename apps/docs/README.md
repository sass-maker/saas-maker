# Docs App — ARCHIVED (not deployed)

> **⚠️ ARCHIVED.** This legacy Astro/Starlight docs site is no longer deployed.
> has been **superseded by the Blume docs** served at
> **[sassmaker.com/docs](https://sassmaker.com/docs)**.
>
> The canonical docs are now the Markdown tree at the repo root (`docs/`),
> rendered by `apps/docs-blume/` (Blume) and folded into the apex site's build
> — `apps/showcase` copies the Blume output into `dist/docs/`, so
> `sassmaker.com/docs` is served by the existing `saas-maker-home` CF Pages
> project. See the merge step in `apps/showcase/scripts/merge-blume-docs.mjs`.
>
> **Do not add content here.** Edit `docs/` instead; Blume is the only production
> documentation presentation layer.
>
> ### Retirement record
>
> The separate `saas-maker-docs` Pages project and `docs.sassmaker.com` alias
> are retired. The canonical replacement is `https://sassmaker.com/docs`.

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
