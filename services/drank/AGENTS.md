<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Shared Fleet Standard

Also read and follow the shared fleet-level agent standard at `../AGENTS.md`. Treat this repository as owned product code: protect production stability, keep changes scoped, verify work, and record durable follow-up tasks when something remains incomplete or blocked.

## What this is

**drank** — a private, local-first Next.js dashboard for tracking Ahrefs
Domain Rating over time. Personal data lives in `localStorage`; a shared
global leaderboard is public JSON refreshed weekly by a GitHub Action.
Product: <https://domains.sassmaker.com>. Full product context:
[`docs/product/overview.md`](docs/product/overview.md).

## Stack

- Next.js 16 App Router + React 19 + TypeScript + Tailwind v4 + Recharts + framer-motion.
- `output: 'export'` → fully static build into `out/`.
- Two Cloudflare Pages Functions (`functions/api/dr.ts`, `functions/api/advisor.ts`) are the only dynamic surface.
- localStorage (v2 schema) for all personal state. No database, no auth.

## Essential commands

| Command | Purpose |
|---|---|
| `pnpm install` | Install deps (pnpm 10+; Node 22+) |
| `pnpm dev` | Dev server → http://localhost:3000 |
| `pnpm build` | Production build (`next build --webpack` → `out/`) |
| `pnpm lint` / `pnpm check` | Biome check |
| `pnpm size` | size-limit on `out/` bundles |
| `pnpm vitest run` | Run tests (no bare `pnpm test` script) |
| `pnpm deploy` | Build + `wrangler pages deploy out --project-name=drank` |
| `pnpm docs:check` | Docs link check + Blume build |
| `pnpm docs:build` | Blume build → `docs-site/dist/` |

## Critical constraints

- **Local-first thesis**: no server-side storage of user data, no accounts.
  Do not add a backend for personal data without an explicit opt-in design.
- **Static export**: Next API routes do not run. Any new dynamic endpoint
  must be a Cloudflare Pages Function under `functions/api/`.
- **Server-only secrets**: gateway credentials for `/api/advisor` live in
  the Pages Function environment (`FREE_AI_GATEWAY_API_KEY` /
  `GATEWAY_API_KEY` / `FREE_AI_BASE_URL`). Never put them in the client
  bundle or commit them. See
  [the advisor gateway runbook](docs/operations/runbooks/advisor-gateway.md).
- **Ahrefs free tier**: pace bulk refreshes (~750 ms client, ~650 ms cron).
  Do not tighten without a reason.
- **Build flag**: `next build --webpack` is required (Turbopack had a CSS
  path issue with static export). Do not drop `--webpack` without verifying.
- **No deploys / migrations / secret rotation from agents** unless the user
  explicitly asks. `main` stays releasable but is not an auto-production trigger.

## Documentation navigation

**Source of truth = committed Markdown.** Blume (`docs-site/`) is only the
presentation + search layer.

- [`docs/index.md`](docs/index.md) — start here; the full doc tree nav.
- [`STATUS.md`](STATUS.md) — short view: current objective, active work, blockers, next steps.
- [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — durable fleet-mandated status record (detail).
- [`docs/product/overview.md`](docs/product/overview.md) — what drank is, who it's for, the cron situation.
- [`docs/architecture/overview.md`](docs/architecture/overview.md) — topology, key files, data flow.
- [`docs/architecture/decisions/`](docs/architecture/decisions/) — ADRs (read before changing the matching system).
- [`docs/development/workflow.md`](docs/development/workflow.md) — setup, commands, testing, lint, build.
- [`docs/operations/runbooks/`](docs/operations/runbooks/) — deploy, advisor gateway, add a global site.
- [`docs/operations/jobs/weekly-global-dr.md`](docs/operations/jobs/weekly-global-dr.md) — the weekly cron.
- [`docs/knowledge/`](docs/knowledge/) — learnings + failed approaches.
- [`docs/archive/`](docs/archive/) — superseded docs kept for history.
- [`openspec/`](openspec/) — spec-driven feature specs (dr-advisor).

## Documentation maintenance rules

1. **One fact, one home.** If a fact lives in code or config, link to it;
   do not restate it. If a fact lives in `docs/`, do not duplicate it in
   `README.md` or `PROJECT_STATUS.md`.
2. **New non-obvious decision → new ADR** under
   `docs/architecture/decisions/` (use `_template.md`). Never renumber;
   supersede with a new ADR that points back.
3. **Durable learnings** → `docs/knowledge/learnings/`. **Abandoned
   approaches** → `docs/knowledge/failed-approaches/` with the reason.
4. **Keep pages short** (150–300 lines). Split rather than grow.
5. **Run `pnpm docs:check` before committing doc changes.** CI runs the
   same gate (link check + Blume build).
6. **Do not edit generated Blume output** (`docs-site/dist/`, `docs-site/.blume/`).
   Edit the Markdown in `docs/` and rebuild.
7. **Preserve history.** Prefer `docs/archive/<name>.md` over deletion.
   Use `git mv` when moving docs so rename history is kept.
8. **Status**: `STATUS.md` is the short view; `PROJECT_STATUS.md` is the
   durable fleet-mandated record. Update `PROJECT_STATUS.md` when PR-sized
   work completes; keep `STATUS.md` in sync as the short view.

## Out of scope for this repo

- A backend that stores user domain lists without explicit opt-in design.
- True always-on server cron for personal lists (requires opt-in storage).
- Paid Ahrefs metrics or backlink-level data.
