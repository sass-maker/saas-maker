# Project Status

Last updated: 2026-06-04

## Current Scope

SaaS Maker is the foundry helper for the fleet: a Cloudflare-first monorepo with the API, cockpit, docs, widgets, reusable blocks, CLI, and experimental Droid surface that coordinate product tasks and fleet operations.

## Done

- Core deployables are documented: API, Cockpit, Droid, Docs, and showcase surfaces.
- The API, cockpit, docs, widgets, blocks, and CLI are active parts of the system.
- The task board, fleet registry, production smoke checks, and audit lanes are used to coordinate work across projects.
- Magic Form Builder has a fixture-backed prototype in `packages/blocks/ops/src/magic-form.ts` with focused tests.
- AI Feedback Digest has a fixture-backed dry-run prototype in `packages/blocks/ops/src/feedback-digest.ts` with focused tests.
- Fleet guidance now requires each project to maintain a root `PROJECT_STATUS.md`.
- The public showcase now derives its project list, helper systems, and count from `foundry.projects.json`.

## Planned Next

1. Keep the fleet registry, README, AGENTS guidance, project status docs, helper classifications, and public showcase synchronized as projects are added or retired.
2. Graduate Magic Form Builder only after product ownership, storage, preview, and integration boundaries are explicit.
3. Graduate AI Feedback Digest only after human-review, task writeback, and production AI-cost controls are explicit.
4. Continue reducing stale deploy/docs references, including old Vercel-style docs where Cloudflare is now canonical.

## Deferred / Parked

- Droid remains experimental until a concrete fleet workflow justifies it.
- Automatic task creation from AI feedback is deferred; humans should review digest output first.
- Production cron/AI workflows for block prototypes are parked until they have clear owners and rollback paths.
