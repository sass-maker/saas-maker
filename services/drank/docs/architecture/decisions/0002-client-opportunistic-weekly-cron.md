# ADR-0002 — Client-opportunistic weekly cron

**Date:** 2026-06
**Status:** accepted

## Context

Users want their personal domains' DR refreshed weekly. But personal data
lives in `localStorage`, which a server cron cannot touch. A real
always-on server cron would require storing each user's domain list
server-side — breaking the local-first, no-account, no-server-storage
thesis.

## Decision

Refresh personal (`isCustom`) domains client-opportunistically: trigger on
mount, `visibilitychange`, `window.focus`, and a 3-hour interval, but only
run the actual refresh if it has been roughly a week since the last auto
refresh. Surface clear UI status ("Next in ~4d"), a manual "Run now", and
an on/off toggle.

## Consequences

- **Positive**: keeps the product local-first; no server storage, no
  account, no privacy trade-off.
- **Negative**: refresh only happens when the tab is open. A user who never
  opens drank does not get fresh data. This is acceptable for the thesis.
- **Watch for**: do not silently add a server-side personal list without an
  explicit opt-in design (see deferred work in PROJECT_STATUS.md).

## Alternatives considered

- **Server-side cron + per-user storage** — rejected: breaks local-first.
  Kept as a possible future opt-in mode (D1 + watch id).
- **Push notification / service-worker cron** — rejected: still cannot
  reach Ahrefs reliably from a background SW on a free endpoint, and adds
  complexity for little gain over the opportunistic approach.

## References

- `lib/useTrackedDomains.ts` (refresh scheduler, `REFRESH_DELAY_MS`)
- [Product overview — the cron situation](../../product/overview.md#the-cron-situation-important)
