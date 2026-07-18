# Superpowers (parked cross-fleet artifact)

This directory holds LinkChat-specific design notes that were parked here
during an earlier cross-fleet workflow experiment. They are **not authoritative
for SaaS Maker** — some reference PostgreSQL/CockroachDB and an older
architecture that predates the move to Cloudflare D1.

Kept for git rename history and as a record of the LinkChat resource-isolation
work. Do not use these as a description of SaaS Maker's current architecture;
see [`../architecture/`](../architecture/README.md) for that.

## Files

- [`plans/2026-03-14-linkchat-resource-isolation.md`](plans/03-14-linkchat-resource-isolation.md) —
  implementation plan for a `source` column on `projects` to hide
  LinkChat-created projects from the SaaS Maker dashboard.
- [`specs/2026-03-14-linkchat-resource-isolation-design.md`](specs/03-14-linkchat-resource-isolation-design.md) —
  design spec for the same.
