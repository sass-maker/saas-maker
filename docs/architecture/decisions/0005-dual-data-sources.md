# ADR-0005 — Dual data sources (build-time static + runtime GitHub raw)

**Date:** 2026-06
**Status:** accepted

## Context

The global leaderboard is shared and refreshed weekly by a GitHub Action
that commits `data/global-dr.json`. We want two things at once: instant
first render (no flash of empty state) and fresh data without redeploying
the app every Monday.

## Decision

Bundle `data/global-dr.json` (and `data/global-sites.json`) at build time
via static import for instant first paint, then re-fetch the live JSON
from the raw GitHub URL in a `useEffect` so weekly cron updates appear
without a redeploy.

## Consequences

- **Positive**: fast first paint; weekly updates are visible to existing
  deployments automatically; no extra infra.
- **Negative**: the build-time copy can be up to a week stale until the
  runtime fetch completes; the runtime fetch depends on GitHub raw
  availability.
- **Watch for**: if the JSON shape changes, both the build-time import and
  the runtime fetch path must handle it. Keep the parser tolerant.

## Alternatives considered

- **Build-time only** — rejected: requires a redeploy every week to show
  fresh data.
- **Runtime only** — rejected: empty state on first paint; depends on
  GitHub raw for every load.
- **A dedicated API endpoint serving the JSON** — rejected: extra surface;
  raw GitHub is already public and cacheable.

## References

- `app/page.tsx` (static import + runtime fetch)
- `data/global-dr.json`, `data/global-sites.json`
- [Weekly global DR job](../../operations/jobs/weekly-global-dr.md)
