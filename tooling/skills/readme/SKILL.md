---
name: readme
description: >
  Generate absurdly thorough project documentation covering local setup,
  architecture, and deployment — the README you wish every project had. Use
  for "write a README", "document this project", "this repo has no readme",
  "onboard someone to this codebase".
---

# readme — absurdly thorough project docs

Three purposes: get a dev running locally in minutes, explain how the system
works, cover production deploy and maintenance.

## Before writing — explore, don't guess

- **Structure**: root layout, entry points, framework/language from manifests
  (`package.json`, `Gemfile`, `pyproject.toml`, `go.mod`, `Cargo.toml`,
  `composer.json`, `mix.exs`).
- **Config**: `.env.example`, env vars referenced in code, CI workflows,
  deploy configs.
- **Data**: schema files, migrations, seeds.
- **Dependencies**: manifest + lockfile; note native deps (pg, nokogiri,
  sharp).
- **Scripts**: `bin/`, `package.json` scripts, Makefile, Procfile, tasks.
- **Fleet specifics**: read `AGENTS.md`/`CLAUDE.md` first — they carry the
  real commands and boundaries; the README must not contradict them.

**Deploy target** from evidence: `wrangler.jsonc`/`.toml` → Cloudflare
Workers/Pages; `vercel.json` → Vercel; `fly.toml` → Fly.io; `Dockerfile` →
Docker; `render.yaml` → Render; `terraform/` → IaC; `k8s/` → Kubernetes.
Fleet convention is Cloudflare Workers — name the worker name, routes, and
`pnpm`/wrangler commands, not generic advice.

Ask the user only for what's genuinely undeterminable: what the product is
for, credentials/URLs, business context.

## Structure (in order)

1. **Title + overview** — what it does and who it's for, 2-3 sentences.
2. **Key features** — bullets, user-visible.
3. **Tech stack** — language, framework, storage, styling, deploy target.
4. **Prerequisites** — exact tools + versions.
5. **Getting started** — clone → install → env vars (table: name, purpose,
   example, required) → data setup → dev server, with the repo's *actual*
   commands, verified by running or reading scripts.
6. **Architecture** — how the parts fit: request flow, storage, external
   services, background work; a diagram in ASCII or a short linked list.
7. **Project structure** — annotated tree of the important dirs only.
8. **Testing/checks** — the real commands (`pnpm test`, `pnpm check`,
   biome via `pnpm exec` — never bare `npx biome`).
9. **Deployment** — exact steps for the detected platform, env/secret setup,
   post-deploy verification.
10. **Troubleshooting** — the 3-5 failures a new person will actually hit,
    with the fix.

## Rules

- Every command must exist — verify against package.json/bin/, never invent.
- Secrets get placeholders and sourcing notes, never real values.
- Match the fleet doc style: tight, scannable, no marketing filler.
- If a README exists, offer a merge/refresh pass instead of overwriting —
  preserve owner voice sections verbatim.
