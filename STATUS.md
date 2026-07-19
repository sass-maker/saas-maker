# STATUS — SaaS Maker

Last updated: 2026-07-18

This is the short, operative view of where SaaS Maker is right now. For the
full timeline and shipped-feature inventory, see
[`PROJECT_STATUS.md`](PROJECT_STATUS.md). For the knowledge base, see
[`docs/README.md`](docs/README.md).

## Current objective

Keep SaaS Maker as the reliable fleet control plane — API, Cockpit, docs,
widgets, CLI, marketing queue, events hub, and Task Workflows — while the
public documentation is consolidated into one local-first knowledge system
(this `docs/` tree) rendered by Blume.

## Active work

- **Documentation consolidation**: the root `docs/` tree is canonical and Blume
  is the only production presentation layer at `sassmaker.com/docs`.
- **Marketing queue ops**: two-stage approvals and reel-pipeline posting-ops
  summaries are live; continue tightening missed-post and metrics-pending
  visibility.
- **Droid graduation**: durable retry/timeout contracts and the 7-day
  success-rate dashboard shipped 2026-07-03; Droid remains experimental but is
  the first concrete fleet workflow via Task Workflows.

## Blockers

- **Owner email notifications** parked pending Cloudflare Email Workers
  provider work (a 2026-04-29 migration attempt hit a token-permission error
  during domain onboarding — Symphony S250).

## Unresolved questions

- The archived Astro/Starlight tree at `apps/docs/` must remain out of production;
  all public documentation changes belong in `docs/` and render through Blume.
- When should Droid graduate from "experimental" to "daily-driver for a defined
  workflow class"? See [`docs/architecture/droid-roadmap.md`](docs/architecture/droid-roadmap.md).

## Next steps

1. Keep the canonical `docs/` tree and Blume build synchronized as part of each
   docs release.
2. Resume the Cloudflare Email Workers migration when the token-permission
   blocker is cleared.
4. Execute the EOY domain-rating (DR ≥ 20) plan in
   [`docs/operations/launch-kit.md`](docs/operations/launch-kit.md).

## Open audit items

From [`AUDIT.md`](AUDIT.md):

- [ ] **FeedbackStatus type too narrow (SDK only)** — routes and
      `internal/contracts` list all 8 values; only public `@saas-maker/sdk`
      types still need widening.
- [ ] **Session ID not unique per IP** — `workers/api/src/ua.ts:45` inflates
      unique-visitor counts.
- [ ] **Split `workers/api/src/db.ts`** (~2360 LOC) — single God file; refactor
      per domain.
