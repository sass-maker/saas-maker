# ADR-0006 — Request pacing for Ahrefs politeness

**Date:** 2026-06
**Status:** accepted

## Context

Ahrefs' free public DR endpoint is generous but has normal rate-limit
protection. "Refresh all" can fire many requests in quick succession; an
unpaced burst gets `429`s and degrades the experience.

## Decision

Pace bulk refreshes with a fixed delay between requests:
`REFRESH_DELAY_MS = 750` in the client (`lib/useTrackedDomains.ts`) and
`DELAY_MS = 650` in the cron script (`scripts/update-global-dr.mjs`). On
`429`, surface a friendly toast and stop.

## Consequences

- **Positive**: stays well within the free tier; friendly toasts instead
  of silent failures.
- **Negative**: "refresh all" is perceptibly slow for large lists (750 ms ×
  N). Acceptable — this is a weekly-cadence product, not a hot loop.
- **Watch for**: do not tighten this without a reason; stale limiter config
  is usually cleanup, not a reason to change the value (fleet standard).

## Alternatives considered

- **No pacing** — rejected: triggers rate limits.
- **Adaptive backoff based on `429`** — rejected: adds complexity for
  little gain over a conservative fixed delay on a free endpoint.

## References

- `lib/useTrackedDomains.ts` (`REFRESH_DELAY_MS = 750`)
- `scripts/update-global-dr.mjs` (`DELAY_MS = 650`)
