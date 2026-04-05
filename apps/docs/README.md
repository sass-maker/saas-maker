# Docs App

Astro Starlight docs for SaaS Maker.

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
