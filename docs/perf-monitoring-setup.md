# Fleet Performance + Error Handling Monitoring

> **Verified 2026-07-03.** Coverage tables below reflect the actual state of
> each project's code, not an aspirational target. Previous versions of this
> doc over-stated adoption; this version is grounded in file-level inspection.

## Overview

Five layers of performance measurement, plus error handling:

1. **Frontend RUM** — `web-vitals` (LCP, CLS, INP, TTFB, FCP) sent to PostHog or a beacon endpoint.
2. **Client-side API timing** — Resource Timing API samples fetch/XHR duration + TTFB per route, sent to PostHog as `api_call_timing` events.
3. **Bundle size tracking** — `size-limit` checks in CI prevent JS/CSS bloat on every PR.
4. **Backend timing** — `Server-Timing` response headers + slow-request logging.
5. **Weekly PSI sweep** — Distributional Lighthouse audits via psi-swarm.
6. **Error handling** — `app.onError()` on Hono workers, React ErrorBoundary / Next.js `error.tsx` on frontends.

---

## 1. Frontend RUM (web-vitals)

### What's measured
- **LCP**, **CLS**, **INP**, **TTFB**, **FCP**

### How it works
A `src/lib/vitals.ts` (Vite SPA) or `components/VitalsReporter.tsx` (Next.js) module registers `web-vitals` listeners, sends metrics to PostHog if available, and falls back to `navigator.sendBeacon()` to a fleet analytics endpoint. PostHog is initialized via `posthog-provider.tsx` / `foundry-monitoring.ts`, wired into the app root layout or `main.tsx`.

### Real coverage

| Status | Projects |
|--------|----------|
| ✅ web-vitals + PostHog wired | anime-list, email-manager, everythingrated, high-signal, karte, looptv, rolepatch, significanthobbies, starboard, swe-interview-prep, today-little-log, truehire, tinygpt/browser |
| ✅ web-vitals only (no PostHog) | ai-game (web3d), taste |
| ⚠️ PostHog only (no web-vitals dep) | open-historia, reader |
| ❌ Not wired | drank (dead vitals files removed), saas-maker (platform, no client RUM) |

> 15/18 frontend projects have RUM wired. The standard pattern is
> `vitals.ts` + `posthog-provider.tsx` + `foundry-monitoring.ts` +
> `analytics.ts`, imported from the app root layout (Next.js) or
> `main.tsx` (Vite SPA).

### Where to view data
- **PostHog** — events named `web_vital` with properties `name`, `value`, `rating`, `id`, `navigation_type`
- Beacon fallback: `https://vitals.fleet.workers.dev/collect`

---

## 2. Client-side API Timing (Resource Timing API)

### What's measured
- **Full round-trip duration** per API route (network + DNS + TLS + server processing)
- **TTFB** (time to first byte) per API route
- **Transfer size** per API route
- Aggregated as **p50 / p90 / max** per normalized route per sampling window

### Why this layer exists
Backend `withTiming()` / `Server-Timing` only measures server processing time —
it cannot capture network RTT, DNS, TLS, or connection setup, which vary by
user region. This layer measures the actual latency the user experiences,
broken down by route, with PostHog's geo data providing regional breakdowns for
free.

### How it works
A `src/lib/api-timing.ts` module polls `performance.getEntriesByType('resource')`
every 30 seconds, filters to `fetch` / `xmlhttprequest` entries matching API URL
patterns (same-origin `/api/` + configurable extra patterns), normalizes routes
(collapses IDs: `/api/articles/123` → `/api/articles/:id`), and emits
`api_call_timing` events to PostHog with p50/p90/max duration + TTFB + transfer
size. Also flushes on `visibilitychange` (page hidden). No call-site changes
needed — the browser records Resource Timing automatically.

**Limitation:** Resource Timing does not expose HTTP status codes for fetch/XHR
calls (browser security restriction). Latency-by-status is not available here;
use backend `Server-Timing` + `app.onError` for that.

### Real coverage (20 browser projects)

| Status | Projects |
|--------|----------|
| ✅ Wired (existing PostHog) | anime-list, email-manager, everythingrated, high-signal, karte, looptv, open-historia, reader, rolepatch, significanthobbies, starboard, swe-interview-prep, truehire, tinygpt/browser |
| ✅ Wired (PostHog added in same pass) | ai-game (web3d), drank, saas-maker (cockpit), verified-bases, research-papers, taste |
| ❌ Not applicable (no browser) | companion-robot, forecast-lab, free-ai, pace, psi-swarm, reel-pipeline, codevetter (Tauri desktop), materia (static, no API calls) |

> 20/20 browser projects have client-side API timing wired. The module is
> `api-timing.ts` (template at `fleet-ops/templates/api-timing.ts`), called
> via `initApiTiming()` alongside `initVitals()` in the app entry point.

### Where to view data
- **PostHog** — events named `api_call_timing` with properties:
  - `project_id`, `route` (normalized), `sample_count`
  - `duration_p50`, `duration_p90`, `duration_max` (ms)
  - `ttfb_p50`, `ttfb_p90` (ms)
  - `transfer_size_total` (bytes)
- Filter by `project_id` to see per-project, or group by `route` for hotspots.
- PostHog's geo data (`$geoip_city`, `$geoip_country`) provides regional
  breakdowns without any client-side changes.

---

## 3. Bundle Size Tracking (size-limit)

> **Low priority.** Bundle size matters only insofar as it affects actual page
> speed. The fleet's perf bar is "is the site fast?" (measured by the PSI
> sweep), not "is the bundle under N KB?" Existing size-limit configs are kept
> but expanding to more projects is not a priority unless a project's LCP
> regresses and bundle size is the root cause.

### What's measured
- **JS bundle** (gzip) — limit varies per project (500 KB default, up to 6 MB for app-heavy projects)
- **CSS bundle** (gzip) — limit: 50 KB

### Real coverage (7 projects — CI-enforced)

| Project | JS limit | CSS limit | CI runs size |
|---------|----------|-----------|--------------|
| ai-game | 5 MB | 50 KB | ✅ |
| anime-list | 500 KB | 50 KB | ✅ |
| drank | 500 KB | 50 KB | ✅ |
| swe-interview-prep | 6 MB | 50 KB | ✅ |
| taste | 500 KB | 50 KB | ✅ |
| today-little-log | 500 KB | 50 KB | ✅ |
| tinygpt/browser | 500 KB | — | ✅ |

> **Missing:** email-manager, everythingrated, free-ai, high-signal, karte,
> knowledge-base, looptv, materia, open-historia, pace, reader, rolepatch,
> saas-maker, significanthobbies, starboard, truehire, verified-bases.

### Adjusting limits
Edit `.size-limit.json` in the project root. Lower the limit to enforce tighter budgets as bundles shrink.

---

## 4. Backend API Timing

### What's measured
- **Response duration** — `performance.now()` wall clock
- **Slow request detection** — >200ms logged via `console.warn`

### How it works
A `withTiming()` wrapper records `performance.now()` at request entry, awaits the handler, adds `Server-Timing: app;dur=<ms>`, and logs slow requests.

### Real coverage (12 projects)

| Project | withTiming | Applied | Server-Timing |
|---------|-----------|---------|---------------|
| anime-list | ✅ | ✅ | ✅ |
| email-manager | ✅ | ✅ | ✅ |
| everythingrated | ✅ | ✅ | ✅ |
| high-signal | ✅ | ✅ | ✅ |
| karte | ✅ | ✅ | ✅ |
| knowledge-base | ✅ (variant: `withTimingHeaders`) | ✅ | ✅ |
| rolepatch | ✅ | ✅ | ✅ |
| significanthobbies | ✅ | ✅ | ✅ |
| starboard | ✅ | ✅ | ✅ |
| swe-interview-prep | ✅ | ✅ | ✅ |
| taste | ✅ | ✅ | ✅ |
| truehire | ✅ | ✅ | ✅ |

> **Missing:** saas-maker, free-ai, open-historia, reader, looptv,
> today-little-log, ai-game, verified-bases.

### Where to view data
- **Browser DevTools** → Network tab → `Server-Timing` header
- **Workers logs** — slow request warnings in `wrangler tail`

---

## 5. PSI Sweep

### What's measured
- **Desktop LCP p50/p75/p90** — distributional Lighthouse via psi-swarm
- **Performance score**

### How it works
`fleet-ops/scripts/fleet-perf-sweep.mjs` runs psi-swarm against production URLs from `saas-maker/scripts/lib/fleet-health-contracts.mjs` (25 prodUrls). Results saved to `fleet-ops/docs/fleet-perf-scoreboard-YYYY-MM-DD.json`.

### Automation
- **GitHub Actions:** scheduled workflow in `.github/workflows/perf-sweep.yml` (weekly).
- **Manual:** `bash scripts/fleet-perf-weekly.sh --runs 3 --concurrency 2`

### Regression check
`fleet-perf-regression-check.mjs` compares the two newest scoreboards, flags LCP p90 regressions >15% (configurable via `--threshold`). Exit 1 if regressions found.

### Existing scoreboards
- `fleet-perf-scoreboard-2026-06-20.json` — baseline sweep

---

## 6. Error Handling

### Frontend error boundaries

| Pattern | Projects |
|---------|----------|
| ✅ Next.js `error.tsx` + `global-error.tsx` | drank, everythingrated, high-signal, karte, looptv, rolepatch, significanthobbies, starboard, truehire |
| ✅ React `<ErrorBoundary>` component | ai-game (web3d), anime-list, email-manager, open-historia, reader, swe-interview-prep, taste, today-little-log |
| ❌ Missing | (none — all frontend projects covered) |

### Backend `app.onError()` / global error handler

| Status | Projects | Pattern |
|--------|----------|---------|
| ✅ Hono `app.onError` | anime-list, email-manager, free-ai, high-signal, open-historia, reader, saas-maker, taste | `app.onError((err, c) => ...)` |
| ✅ Pages Functions try/catch | swe-interview-prep, today-little-log | try/catch around `next()` in `_middleware.ts` |
| ✅ OpenNext worker try/catch | everythingrated, karte, rolepatch, significanthobbies, starboard, truehire | try/catch around `openNext.fetch()` in `worker.mjs` |
| ❌ Missing | (none — all API projects covered) | |

> **PostHog is the fleet error tracking standard** (no Sentry). Frontend
> error boundaries send `error_captured` / `foundry_page_crash` events to
> PostHog via `foundry-monitoring.ts`'s `captureError()` / `capturePageCrash()`.
> Backend `app.onError` / try/catch handlers log to `console.error` with a
> consistent format. No structured logging library (pino/winston) is used —
> all logging is `console.log/warn/error`.

### Reference patterns

**Hono worker `app.onError`:**
```ts
app.onError((err, c) => {
  console.error(`[error] ${c.req.method} ${c.req.path}:`, err.message, err.stack);
  return c.json({ error: 'Internal Server Error' }, 500);
});
```

**React ErrorBoundary (Vite SPA):**
```tsx
// components/ErrorBoundary.tsx
import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error) { console.error('[ErrorBoundary]', err); }
  render() { return this.state.hasError ? <div>Something went wrong.</div> : this.props.children; }
}
```

---

## Quick reference

| Layer | Tool | Where | CI? | Real coverage |
|-------|------|-------|-----|---------------|
| Frontend RUM | web-vitals + PostHog | Client-side | No | 15/18 frontend projects |
| Client-side API timing | Resource Timing API + PostHog | Client-side | No | 20/20 browser projects |
| Bundle size | size-limit | `.size-limit.json` | Yes (per PR) | 7/26 projects (low priority) |
| Backend timing | performance.now() | API routes | No | 12/27 projects |
| PSI sweep | psi-swarm | fleet-ops/scripts | Weekly (GHA) | All prod URLs |
| Error tracking | PostHog + app.onError + ErrorBoundary | Workers + frontends | No | All projects |

---

## Adding perf monitoring to a new project

### Frontend RUM
1. `pnpm add web-vitals posthog-js`
2. Create `src/lib/vitals.ts` with the `initVitals()` pattern (see anime-list for reference)
3. Call `initVitals()` in the app entry point
4. Initialize PostHog with `posthog.init()`

### Client-side API timing
1. Copy `fleet-ops/templates/api-timing.ts` to `src/lib/api-timing.ts`
2. Set the `_projectSlug` constant to your project slug
3. Call `initApiTiming()` alongside `initVitals()` in the app entry point
4. (Optional) Pass `urlPatterns` to match cross-origin API hosts

### Bundle size
1. `pnpm add -D size-limit @size-limit/file`
2. Create `.size-limit.json` with paths matching build output
3. Add `"size": "size-limit"` script to package.json
4. Add `pnpm run size` step to CI after build

### Backend timing
1. Create timing wrapper in `functions/_lib/timing.ts` or `src/lib/timing.ts`
2. Wrap API handlers with `withTiming()`
3. Verify `Server-Timing` header appears in responses

### Error handling
1. **Hono worker:** add `app.onError()` after route registration
2. **Vite SPA:** create `components/ErrorBoundary.tsx`, wrap `<App>` in `main.tsx`
3. **Next.js:** add `app/error.tsx` + `app/global-error.tsx`
