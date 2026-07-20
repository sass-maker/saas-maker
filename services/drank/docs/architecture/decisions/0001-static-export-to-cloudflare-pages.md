# ADR-0001 — Static export to Cloudflare Pages

**Date:** 2026-06 (migrated from Vercel)
**Status:** accepted

## Context

drank is a local-first product: no server-side user data, no auth, no
per-request rendering needs. The only dynamic surface is the Ahrefs proxy
(and later the DR Advisor gateway). The fleet standard is Cloudflare for
hosting, and the app had outgrown Vercel's free tier expectations.

## Decision

Build with `output: 'export'` (fully static Next.js build into `out/`) and
deploy to Cloudflare Pages. Implement the two dynamic endpoints as Pages
Functions under `functions/api/` instead of Next API routes.

## Consequences

- **Positive**: trivial deploys, no Node server to run, fast CWV, free-tier
  friendly, aligns with the fleet Cloudflare standard.
- **Negative**: Next API routes do not work — any new dynamic endpoint must
  be a Pages Function. No SSR, no server actions, no per-route server cache.
- **Watch for**: any feature that seems to need SSR should first be checked
  against the local-first constraint; if it genuinely needs a server, it
  probably belongs in a Pages Function or a separate Worker.

## Alternatives considered

- **Stay on Vercel with Next API routes** — rejected: fleet standard is
  Cloudflare; the app is static anyway.
- **Cloudflare Workers + separate static host** — rejected: Pages Functions
  co-locate the dynamic endpoints with the static assets and share deploy.

## References

- `next.config.ts` (`output: 'export'`)
- `wrangler.toml` (`pages_build_output_dir = "out"`)
- [ADR-0004](0004-pages-functions-as-api-proxy.md)
