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

- **Documentation consolidation** (this branch): unifying the scattered `docs/`
  tree, the Blume content, and the root status files into one canonical
  knowledge system with validation and CI checks.
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
- **Pre-existing API typecheck errors**: `TraceOptions.project` and
  `SendOptions.template` not in type definitions (noted 2026-04-29).

## Unresolved questions

- Should the legacy Astro/Starlight docs at `apps/docs/` be cut over to Blume
  (which now renders `docs/`)? The two currently hold slightly divergent copies
  of the public product docs. Open: decide the cutover timeline and retire the
  duplicate.
- When should Droid graduate from "experimental" to "daily-driver for a defined
  workflow class"? See [`docs/architecture/droid-roadmap.md`](docs/architecture/droid-roadmap.md).

## Next steps

1. Finish and review the documentation consolidation (validation script, CI
   check, Blume build verification).
2. Decide the Astro → Blume docs cutover plan.
3. Resume the Cloudflare Email Workers migration when the token-permission
   blocker is cleared.
4. Execute the EOY domain-rating (DR ≥ 20) plan in
   [`docs/operations/launch-kit.md`](docs/operations/launch-kit.md).

## Open audit items

From [`AUDIT.md`](AUDIT.md):

- [ ] **FeedbackStatus type too narrow** — DB and routes use up to 8 values;
      public SDK types still need widening.
- [ ] **Session ID not unique per IP** — `workers/api/src/ua.ts:45` inflates
      unique-visitor counts.
- [ ] **Split `workers/api/src/db.ts`** (1738 LOC) — single God file; refactor
      per domain.
