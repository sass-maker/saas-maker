# web-vitals RUM dependency

**Tried:** A `web-vitals` dependency reporting LCP/CLS/INP/TTFB as RUM
events.

**Why it seemed good:** Standard way to capture Core Web Vitals in the
browser.

**Why it failed:**

- The events had no consumer that justified the dependency weight.
- Client-side API call timing via the Resource Timing API
  (`lib/api-timing.ts`) covers the latency observability we actually use,
  without an extra package.

**What we do instead:** Removed the `web-vitals` dependency and the unused
vitals files; kept `lib/api-timing.ts` for fetch/XHR timing → PostHog.
PostHog crash/error capture remains via `lib/foundry-monitoring.ts`.

**Commits:** `4278094` (add error boundaries; remove dead web-vitals dep),
`d9ab244` (status update).
