# Fleet Performance Monitoring

## Overview

The fleet has three layers of performance measurement:

1. **Frontend RUM** — Real User Monitoring via `web-vitals` (LCP, CLS, INP, TTFB, FCP) collected from real page loads and sent to PostHog or a beacon endpoint.
2. **Bundle size tracking** — `size-limit` checks in CI prevent JS/CSS bundle bloat regressions on every PR.
3. **Backend timing** — `Server-Timing` response headers + slow-request logging on all API routes.
4. **Weekly PSI sweep** — Distributional Lighthouse audits via psi-swarm, producing a dated scoreboard + regression check.

## 1. Frontend RUM (web-vitals)

### What's measured
- **LCP** (Largest Contentful Paint) — when the largest visible element renders
- **CLS** (Cumulative Layout Shift) — visual stability score
- **INP** (Interaction to Next Paint) — responsiveness to user input
- **TTFB** (Time to First Byte) — server response time
- **FCP** (First Contentful Paint) — first content render

### How it works
Each frontend project has a `src/lib/vitals.ts` (or `src/components/VitalsReporter.tsx` for Next.js) module that:
1. Registers `web-vitals` listeners on page load
2. Sends each metric to PostHog if `posthog` is available on `window`
3. Falls back to `navigator.sendBeacon()` to a fleet analytics endpoint

### Where to view data
- **PostHog** — events named `web_vital` with properties `name`, `value`, `rating`, `id`, `navigation_type`
- Query: `web_vital` events grouped by `name` to see p50/p75/p90 per metric per project

### Projects with RUM
All frontend projects: ai-game, anime-list, drank, email-manager, everythingrated, high-signal, karte, looptv, open-historia, reader, rolepatch, saas-maker, significanthobbies, starboard, swe-interview-prep, taste, today-little-log, truehire, tinygpt/browser.

## 2. Bundle Size Tracking (size-limit)

### What's measured
- **JS bundle** (gzip) — limit: 500 KB per project
- **CSS bundle** (gzip) — limit: 50 KB per project

### How it works
Each Vite/SPA project has a `.size-limit.json` config that specifies the build output glob and limits. CI runs `pnpm run size` (or `npm run size`) after the build step. If the bundle exceeds the limit, CI fails.

### Projects with size tracking
ai-game, anime-list, drank, open-historia, swe-interview-prep, taste, today-little-log, tinygpt/browser.

### Adjusting limits
Edit `.size-limit.json` in the project root. Lower the limit to enforce tighter budgets as bundles shrink. The 500 KB starting point is generous — tighten per project as you optimize.

## 3. Backend API Timing

### What's measured
- **Response duration** — wall clock time from request entry to response, via `performance.now()`
- **Slow request detection** — any request taking >200ms is logged via `console.warn`

### How it works
Each API project has a `withTiming()` wrapper that:
1. Records `performance.now()` at request entry
2. Awaits the handler
3. Adds a `Server-Timing: app;dur=<ms>` response header
4. Logs `[slow] METHOD /path — Xms` for requests over 200ms

### Where to view data
- **Cloudflare Workers dashboard** — `Server-Timing` header visible in browser DevTools → Network tab
- **Workers logs** — slow request warnings appear in `wrangler tail` and Cloudflare dashboard logs
- **PostHog** — if PostHog is initialized on the frontend, the `Server-Timing` header can be parsed and correlated

### Projects with backend timing
All projects with API routes: anime-list, email-manager, everythingrated, high-signal, karte, looptv, open-historia, reader, rolepatch, saas-maker, significanthobbies, starboard, swe-interview-prep, taste, today-little-log, truehire.

## 4. Weekly PSI Sweep

### What's measured
- **Desktop LCP p50/p75/p90** — distributional Lighthouse audits via psi-swarm
- **Performance score** — Lighthouse 100-point performance score

### How it works
`fleet-ops/scripts/fleet-perf-sweep.mjs` runs psi-swarm against all production URLs (from `fleet-health-contracts.mjs`). Results are saved to `fleet-ops/docs/fleet-perf-scoreboard-YYYY-MM-DD.json`.

### Running the weekly sweep

```bash
cd fleet-ops
bash scripts/fleet-perf-weekly.sh --runs 3 --concurrency 2
```

This runs the sweep and then the regression check against the previous scoreboard.

### Regression check

`fleet-ops/scripts/fleet-perf-regression-check.mjs` compares the two newest scoreboards and flags projects where LCP p90 regressed by more than 15% (configurable via `--threshold`).

```bash
node scripts/fleet-perf-regression-check.mjs --threshold 20
```

Exit code 1 if any regressions are found.

### Existing scoreboards
- `fleet-perf-scoreboard-2026-06-20.json` — baseline sweep (28 projects, 2 runs each)
- `fleet-perf-master-list-2026-06-23.md` — 240+ findings ranked by ROI
- `fleet-perf-opportunities-2026-06-23.md` — per-project analysis

## Quick reference

| Layer | Tool | Where | CI? | Frequency |
|-------|------|-------|-----|-----------|
| Frontend RUM | web-vitals + PostHog | Client-side | No | Every page load |
| Bundle size | size-limit | `.size-limit.json` | Yes (per PR) | Every push |
| Backend timing | performance.now() | API routes | No | Every request |
| PSI sweep | psi-swarm | fleet-ops/scripts | Manual | Weekly |

## Adding perf monitoring to a new project

### Frontend RUM
1. `pnpm add web-vitals`
2. Create `src/lib/vitals.ts` with the `initVitals()` pattern
3. Call `initVitals()` in the app entry point

### Bundle size
1. `pnpm add -D size-limit @size-limit/file`
2. Create `.size-limit.json` with paths matching build output
3. Add `"size": "size-limit"` script to package.json
4. Add `pnpm run size` step to CI after build

### Backend timing
1. Create timing wrapper in `functions/_lib/timing.ts` or `src/lib/api-timing.ts`
2. Wrap API handlers with `withTiming()`
3. Verify `Server-Timing` header appears in responses
