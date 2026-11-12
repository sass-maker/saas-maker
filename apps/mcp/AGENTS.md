# SaaS Maker MCP Connections agent instructions

- Preserve the existing connections' read-only contracts. The owner authorized
  Anchor account data/actions on 2026-11-08. Only its explicit native toolScopes
  allowlist may write, with anchor.read + anchor.write, product-side independent
  authorization and account isolation. No administrative tools, device-private
  fields or shared application credentials. New write routes require explicit
  runtime activation after companion-service and native qualification.
- Do not touch secrets, environment files, Cloudflare configuration, Auth0
  configuration, or production resources unless explicitly requested.
- Production deploys are manual and must use `pnpm run deploy` from a clean,
  synced `main` with green CI at the exact revision.
- Keep public routes anonymous and private routes audience-bound, user-scoped,
  and independently verified by the owning product.
- Run `pnpm check` after source, auth, route, listing, or monitoring changes.
- This independent package lives at `apps/mcp` in `sass-maker/saas-maker`.
  Run `pnpm check` and `pnpm run deploy` from this directory. Deployments require
  the repository's `mcp-ci.yml` workflow at the exact source revision.
- Track operational work in SaaS Maker's GitHub Issues and keep
  `PROJECT_STATUS.md` current when durable product truth changes.

- `local/daddyrad` owns the local, read-only Swift stdio connection for the four
  DaddyRad native cores. It is part of MCP Connections, with no hosted route,
  network listener or access to running GUI state. Run `pnpm check:daddyrad`
  on macOS for changes to this connection. Keep the exact engine revisions in
  `Package.swift` and `engine-revisions.json` aligned.
