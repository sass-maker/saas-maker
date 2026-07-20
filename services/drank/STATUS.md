# STATUS — short view

> **Durable record:** [`PROJECT_STATUS.md`](PROJECT_STATUS.md) is the
> fleet-mandated status file (Why/What, Dependencies, Timeline, Products,
> Features, Todo/Planned/Deferred/Blocked). This file is the short view —
> keep it in sync, do not duplicate detail here.

**Last updated:** 2026-07-18

## Current objective

Keep drank a stable, local-first DR tracker with a healthy shared data
pipeline and a conservative, honest DR Advisor — and consolidate the
repo's knowledge into one agent- and human-readable documentation system
(this round).

## Active work

- Repository knowledge consolidation: canonical `docs/` tree, ADRs,
  runbooks, Blume presentation layer, docs validation + CI. (Branch
  `docs/knowledge-system`.)

## Shipped recently

- Public `/data` page with weekly DR movers + downloadable JSON; weekly
  action now syncs `public/data` copies.
- DR Advisor shipped on the Cloudflare Pages architecture (explicit,
  grounded, browser-cached, fail-closed).
- Agent indexing surfaces (`llms.txt`, `llms-full.txt`, `index.md`,
  `/api/ai`, `robots.txt`, sitemap, IndexNow key).
- Brand favicon refresh; fleet-generated JSON-LD.

## Blockers

- Real background server crons cannot touch per-user `localStorage` —
  weekly personal refresh only runs when the tab is open (by design).

## Unresolved questions

- Should the weekly GitHub Action move from `drank/.github/workflows/` to
  the fleet monorepo root `.github/workflows/`? (Tracked as planned work.)
- Is there a future opt-in server-side personal cron worth building
  (Cloudflare D1 + watch id)? Deferred until a real user asks.

## Next steps

1. Finish docs consolidation: land `docs/knowledge-system` after human
   review (link check + Blume build green).
2. Wire the Blume docs site to a Cloudflare Pages project + custom domain
   when ready (presentation layer only; `docs/` stays source of truth).
3. Move the weekly DR Action to the monorepo root `.github/workflows/`
   when the fleet monorepo is the right home.
4. Grow test coverage beyond the current focused set if logic with
   parseable contracts is added.

See [PROJECT_STATUS.md](PROJECT_STATUS.md) for the full durable record.
