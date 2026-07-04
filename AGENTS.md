<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Shared Fleet Standard

Also read and follow the shared fleet-level agent standard at `../AGENTS.md`. Treat this repository as owned product code: protect production stability, keep changes scoped, verify work, and record durable follow-up tasks when something remains incomplete or blocked.

## Project

- **Stack**: Next.js 16, React 19, Tailwind v4, localStorage-only (no backend DB).
- **Package manager**: pnpm
- **Local dev**: `pnpm dev` (http://localhost:3000)
- **Deploy**: Cloudflare Pages (`drank`) via `pnpm deploy` (`wrangler pages deploy out`).
