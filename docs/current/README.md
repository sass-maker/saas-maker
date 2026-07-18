# Current State

This directory holds the short-form, current-state view of SaaS Maker. For the
durable knowledge base, see the parent [`docs/README.md`](../README.md).

- [`../../STATUS.md`](../../STATUS.md) — concise current objective, active work,
  blockers, unresolved questions, and next steps.
- [`../../PROJECT_STATUS.md`](../../PROJECT_STATUS.md) — detailed timeline of
  shipped changes and the full feature inventory. Kept at the repo root because
  `pnpm check:fleet-contracts` verifies its presence across the fleet.

## How to keep these current

`STATUS.md` is the operative short view — update it whenever the objective,
active work, blockers, or next steps change. `PROJECT_STATUS.md` is the
append-only timeline — add a dated entry when a meaningful change ships; do not
rewrite history there.
