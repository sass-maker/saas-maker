# drank — documentation index

**drank** is a private, local-first Next.js dashboard for tracking Ahrefs
Domain Rating (DR) over time. Personal data lives in `localStorage`; a shared
global leaderboard is published as public JSON and refreshed weekly by a
GitHub Action. Product: <https://domains.sassmaker.com>.

This `docs/` tree is the canonical source of truth for product knowledge,
architecture, decisions, workflows, operations, and durable learnings.
Blume (see [`docs-site/`](../docs-site)) is only the presentation + search
layer over this tree. Edit the Markdown here; never edit generated Blume
output.

## Start here

- [Product overview](product/overview.md) — what drank is, who it's for, the cron situation.
- [STATUS.md](../STATUS.md) — short view of current objective, active work, blockers, next steps.
- [PROJECT_STATUS.md](../PROJECT_STATUS.md) — durable fleet-mandated status record (detail).
- [AGENTS.md](../AGENTS.md) — agent bootloader (commands, constraints, doc nav).

## Architecture

- [Architecture overview](architecture/overview.md) — static export, Pages Functions, localStorage, dual data sources.
- [How it works, end to end](architecture/how-it-works.md) — a guided walk-through of the components, data flows, and the "why" behind each decision.
- [Decisions (ADRs)](architecture/decisions/) — recorded technical decisions and their rationale.

## Development

- [Development workflow](development/workflow.md) — setup, commands, testing, lint, build, size limits.

## Operations

- [Deploy runbook](operations/runbooks/deploy.md) — Cloudflare Pages deploy, CI auto-deploy, wrangler.
- [Configure DR Advisor gateway](operations/runbooks/advisor-gateway.md) — server-side secrets for the advisor.
- [Add a global site](operations/runbooks/add-global-site.md) — extend the shared leaderboard.
- [Weekly global DR job](operations/jobs/weekly-global-dr.md) — the GitHub Action that refreshes shared data.

## Knowledge

- [Learnings](knowledge/learnings/) — study queue for non-obvious tech in this repo.
- [Failed approaches](knowledge/failed-approaches/) — what we tried and abandoned, and why.

## How this tree is maintained

- One fact, one home. If a fact lives in code or config, link to it; do not
  restate it. If a fact lives here, do not duplicate it elsewhere.
- New decisions get a new ADR under `architecture/decisions/` (see
  [the ADR template](architecture/decisions/_template.md)).
- Durable learnings go under `knowledge/learnings/`; abandoned approaches go
  under `knowledge/failed-approaches/` with the reason.
- Keep pages short (150–300 lines). Split rather than grow.
- Run `pnpm docs:check` before committing doc changes (link check + Blume
  build). CI runs the same gate.
