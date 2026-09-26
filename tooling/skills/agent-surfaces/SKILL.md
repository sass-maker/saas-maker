---
name: agent-surfaces
description: Wire the Fleet GEO contract into a product repo — llms.txt, /api/ai discovery catalog, markdown alternates on public routes, robots + sitemap, and the JSON-LD @graph block. Use when a site needs agent/LLM discoverability implemented (not audited — that's agent-ready), when project-readiness flags agent.* gaps, or when adding agent-readable surfaces to a new project.
---

# agent-surfaces — implement the GEO contract

The apply-side counterpart to `agent-ready` (which audits). The contract,
modes, and pass rules live in `tooling/docs/agent-indexing-standard.md` —
read it first; this skill is the how-to, not the spec.

## What to build

| Surface | Contract |
|---|---|
| `/llms.txt` | 200, `text/plain`/`text/markdown`, starts with `#`, never HTML |
| `/api/ai` | JSON discovery catalog (`name`, `llms`, `sitemap`, `markdown`, `surfaces[]`, `auth`) |
| Route markdown | every public sitemap URL readable as markdown (`.md` suffix and/or `Accept: text/markdown` negotiation) |
| `robots.txt` + `sitemap.xml` | public crawl allowed, `Sitemap:` line present, auth/private paths disallowed |
| JSON-LD `@graph` | Organization + WebSite/SoftwareApplication nodes |
| Name agreement | canonical name identical across llms.txt, `/api/ai`, JSON-LD — casing and slugs count as mismatches |
| HEAD/GET parity | agent endpoints answer HEAD with the same status class as GET |

## Pick the mode, then the adapter

Modes (from the standard): **A** static marketing → build-emitted files in
`public/`/`dist/`; **B** content collections → markdown from source MD/MDX;
**C** DB-dynamic → same loaders as HTML, cached; **D** SPA+API → curated
llms.txt + API-resource markdown, never empty shells.

Helpers in `tooling/lib/agent-surfaces/` (zero-dep, Workers-safe):

- `createAgentSurfaceManifest` + `createAgentSurfaceHandler` — the whole
  contract as one handler
- `adapters/worker.mjs` — OpenNext/CF Worker; prepend **before**
  `openNext.fetch`
- `adapters/hono.mjs` — Hono middleware **before** the SPA fallback
- `adapters/pages-middleware.mjs` — CF Pages Functions
- `adapters/astro-build.mjs` — emit `.md` + `llms.txt` at build time

Starters in `tooling/templates/agent-surfaces/` (`llms.txt.tmpl`,
`api-ai.example.json`, `robots-ai-snippet.txt`, `index.md.tmpl`).

Reference implementations: `saas-maker/apps/docs/scripts/generate-llms-txt.mjs`
(corpus generator), `significanthobbies/src/app/llms-full.txt/route.ts`
(Accept negotiation), `karte/` (S+ agent-native: skill.md + well-known
skills index).

## Hard rules

- **SPA honesty**: agent paths must beat the SPA catch-all. A file in
  `public/` is worthless if `single-page-application` handling returns an
  HTML shell for it — test `/llms.txt`, `/index.md`, and a real route's `.md`.
- Markdown is the public product truth — same claims as the HTML page.
  Prefer source→markdown over HTML→markdown conversion.
- Private/auth surfaces stay out of the index; declare them in
  `/api/ai.auth`.
- JSON-LD `SoftwareApplication` types need real `aggregateRating`/`review`
  evidence — otherwise use `WebSite`. Never emit `SearchAction` without a
  real `searchUrlTemplate`.
- Name agreement is checked exactly — ship the canonical name, not the repo
  slug.

## Verify

```bash
node tooling/scripts/agent-index-audit.mjs <url>            # or skills/agent-ready/scripts/
node tooling/scripts/project-readiness.mjs --project <id> --live
```

S-tier requires every surface above; `live.llms`, `live.apiAi`,
`live.sitemap` must pass on the deployed origin.
