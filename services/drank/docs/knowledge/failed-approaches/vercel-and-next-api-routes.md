# Vercel hosting + Next API routes

**Tried:** Hosting drank on Vercel with Next.js API routes for the Ahrefs
proxy.

**Why it seemed good:** Default Next.js path; zero-config deploys; API
routes are the idiomatic dynamic surface.

**Why it failed:**

- The fleet standard is Cloudflare, not Vercel.
- The app is fully static (`output: 'export'`) — there is no Node server
  to run Next API routes. Keeping them would have meant running a Node
  server just for one proxy endpoint.

**What we do instead:** Static export to Cloudflare Pages; the Ahrefs
proxy (and later the advisor) are Cloudflare Pages Functions under
`functions/api/`. See
[ADR-0001](../../architecture/decisions/0001-static-export-to-cloudflare-pages.md)
and [ADR-0004](../../architecture/decisions/0004-pages-functions-as-api-proxy.md).

**Commits:** `b846968` (migrate to Cloudflare Pages), `6e1a6e4` (fix
deploy target in AGENTS.md).
