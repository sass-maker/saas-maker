# Project Status

Last updated: 2026-06-20

## Current Scope

SaaS Maker is the foundry helper for the fleet: a Cloudflare-first monorepo with the API, cockpit, docs, widgets, reusable blocks, CLI, and experimental Droid surface that coordinate product tasks and fleet operations.

## Done

- Core deployables are documented: API, Cockpit, Droid, Docs, and showcase surfaces.
- The API, cockpit, docs, widgets, blocks, and CLI are active parts of the system.
- The task board, task-linked workflows, fleet registry, production smoke checks, and audit lanes are used to coordinate work across projects.
- Task Workflows MVP is implemented in SaaS Maker only: workflow definitions store Markdown context and prompt templates, Cockpit task detail can run them through Droid native mode, and saved Markdown outputs get stable share pages.
- Droid loop policies now execute bounded retries with per-attempt events, blocker-aware stops, retry-on-failure controls, and max-attempt exhaustion reporting.
- Fleet registry sync is enforced by `pnpm check:fleet-contracts`, which compares `foundry.projects.json`, `docs/fleet-canonical-projects.md`, `scripts/lib/fleet-health-contracts.mjs`, and local active project dirs with `PROJECT_STATUS.md`.
- Magic Form Builder has a fixture-backed prototype in `packages/blocks/ops/src/magic-form.ts` with focused tests.
- AI Feedback Digest has a fixture-backed dry-run prototype in `packages/blocks/ops/src/feedback-digest.ts` with focused tests.
- Fleet guidance now requires each project to maintain a root `PROJECT_STATUS.md`.
- The public showcase now derives its project list, helper systems, and count from `foundry.projects.json`; the registry now includes `knowledgebase`, `pace`, `researchPapers`, and `sarthakagrawal`.
- **CI/turbo recovery (2026-06-20):** restored missing `turbo.json`, fixed CI pnpm version conflict, removed dead `build:email` steps, and pointed root tests back at `vitest run` (320 tests). Cockpit builds via turbo dependency graph.
- **API telemetry inlined (2026-06-20):** `workers/api/src/lib/telemetry.ts` replaces direct `@saas-maker/ops` usage in the API worker; `@saas-maker/ops` remains published for external consumers.
- **Dead email block removed (2026-06-20):** deleted orphaned `@saas-maker/email` package and Resend notification sends from feedback/waitlist routes. Email Workers migration remains tracked separately in fleet docs.
- **RAG service integration (2026-06-20):** knowledge routes support `RAG_BACKEND=local|dual|service`, service-backed search, dual-run comparison, and `/v1/knowledge/indexes/:id/export` for pre-embedded backfill into `rag-service`.
- **Astro landing tooling (2026-06-20):** `@saas-maker/astro-landing` CLI ships Beasties critical CSS inlining + landing overlay helpers for fleet OpenNext/Astro migrations.
- **Fleet hub events (2026-06-20):** events sink + task queue + worker SDK for fleet project auth/integration.

## Planned Next

1. Keep the fleet registry, README, AGENTS guidance, project status docs, helper classifications, health contracts, and public showcase synchronized as projects are added or retired.
2. Graduate Magic Form Builder only after product ownership, storage, preview, and integration boundaries are explicit.
3. Graduate AI Feedback Digest only after human-review, task writeback, and production AI-cost controls are explicit.
4. Tighten Task Workflows after real use: automatic Droid result capture, richer run status/events in the panel, and clearer artifact lifecycle controls.
5. Continue reducing stale deploy/docs references when concrete drift is found.
6. Execute the EOY DR plan in `docs/launch-kit.md` — target DR ≥ 20 on all seven owned domains by 2026-12-31 via staggered launches, directories, and linkable assets.
7. Complete the RAG migration cutover after backfilling existing knowledge indexes and running dual-mode recall/latency comparison against production-shaped data.

## Deferred / Parked

- Droid remains experimental, but Task Workflows is now the first concrete fleet workflow using Droid from Cockpit.
- Automatic task creation from AI feedback is deferred; humans should review digest output first.
- Production cron/AI workflows for block prototypes are parked until they have clear owners and rollback paths.
- Owner email notifications for feedback/waitlist are parked pending Cloudflare Email Workers provider work.
