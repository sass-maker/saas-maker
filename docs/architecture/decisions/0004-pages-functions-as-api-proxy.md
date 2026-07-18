# ADR-0004 — Pages Functions as API proxy

**Date:** 2026-06 (with the Vercel → Cloudflare migration)
**Status:** accepted

## Context

`output: 'export'` produces a static build; Next.js API routes do not run.
The app still needs one dynamic endpoint: a proxy to Ahrefs' free public DR
endpoint. The proxy exists for two reasons:

1. **CORS** — the browser cannot call `api.ahrefs.com` directly.
2. **User-Agent** — Ahrefs rejects requests without a `User-Agent` header,
   and browsers cannot set `User-Agent` on cross-origin `fetch()`.

## Decision

Implement the proxy as a Cloudflare Pages Function at
`functions/api/dr.ts`, served at `/api/dr` by `wrangler pages deploy`. It
normalizes the target, sets a friendly `User-Agent`, forwards to Ahrefs,
and returns `{domain, dr, fetchedAt}`. The same pattern was later used for
`functions/api/advisor.ts`.

## Consequences

- **Positive**: dynamic endpoints co-located with the static build; same
  deploy; same path (`/api/dr`) as the old Next route, so the client did
  not change.
- **Negative**: any new dynamic endpoint must be a Pages Function, not a
  Next API route. The Pages Function signature (`onRequestGet` /
  `onRequestPost`) differs from Next handlers.
- **Watch for**: Pages Functions run on the Workers runtime — no Node APIs
  (use `fetch`, `URL`, `AbortSignal.timeout`, web streams).

## Alternatives considered

- **A separate Worker for the proxy** — rejected: extra deploy surface;
  Pages Functions are simpler here.
- **A third-party CORS proxy** — rejected: unreliable, leaks the request,
  and cannot set `User-Agent`.

## References

- `functions/api/dr.ts`, `functions/api/advisor.ts`
- [ADR-0001](0001-static-export-to-cloudflare-pages.md)
