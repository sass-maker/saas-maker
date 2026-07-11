# Fleet Performance + Error Handling Monitoring

> **Verified 2026-07-03.** Coverage tables reflect actual code state, not aspirations.

## Overview

Six layers:

1. **Frontend RUM** — `web-vitals` (LCP, CLS, INP, TTFB, FCP) → PostHog or beacon
2. **Client-side API timing** — Resource Timing API → PostHog `api_call_timing` events
3. **Bundle size** — `size-limit` in CI (low priority — LCP is the real gate)
4. **Backend timing** — `Server-Timing` headers + slow-request logging
5. **Weekly PSI sweep** — psi-swarm distributional Lighthouse
6. **Error handling** — `app.onError()` on Hono workers, ErrorBoundary / `error.tsx` on frontends

---

## Coverage (active project surfaces)

### Frontend RUM

| Status | Projects |
|--------|----------|
| ✅ web-vitals + PostHog | anime-list, email-manager, high-signal, karte, looptv, rolepatch, significanthobbies, starboard, swe-interview-prep, tinygpt/browser |
| ✅ web-vitals only (no PostHog) | alive-ville (`ai-game` web3d) |
| ⚠️ PostHog only (no web-vitals) | reader |
| ❌ Not wired | drank, saas-maker (platform, no client RUM) |

### Client-side API timing

| Status | Projects |
|--------|----------|
| ✅ Wired | anime-list, email-manager, high-signal, karte, looptv, reader, rolepatch, significanthobbies, starboard, swe-interview-prep, tinygpt/browser, alive-ville (`ai-game` web3d), drank, saas-maker (cockpit), research-papers |
| ❌ N/A (no browser) | free-ai, pace, reel-pipeline, codevetter (Tauri) |

Template: `fleet-ops/templates/api-timing.ts`

### Backend timing (withTiming / Server-Timing)

| ✅ Wired | anime-list, email-manager, high-signal, karte, knowledge-base, rolepatch, significanthobbies, starboard, swe-interview-prep |
|----------|---|
| ❌ Missing | saas-maker, free-ai, reader, looptv, alive-ville (`ai-game`) |

### Error handling

All frontend projects have error boundaries (Next.js `error.tsx` or React `<ErrorBoundary>`).
All API projects have `app.onError()` or equivalent try/catch. PostHog is the error tracking standard (no Sentry).

---

## PSI sweep (2026-07-03)

All 15 active production URLs in the last sweep passed the LCP gate (p75 ≤ 2.5s).

| Project | LCP p75 | Gate |
|---------|---------|------|
| anime-list | 211 ms | ✅ |
| starboard | 209 ms | ✅ |
| reader | 238 ms | ✅ |
| email-manager | 239 ms | ✅ |
| drank | 322 ms | ✅ |
| looptv | 500 ms | ✅ |
| karte | 541 ms | ✅ |
| tinygpt | 567 ms | ✅ |
| alive-ville (`ai-game`) | 568 ms | ✅ |
| rolepatch | 618 ms | ✅ |
| research-papers | 629 ms | ✅ |
| high-signal | 677 ms | ✅ |
| swe-interview-prep | 884 ms | ✅ |
| significanthobbies | 1.02 s | ✅ |
| saas-maker | 2.20 s | ✅ (watch) |

**Watch list:** saas-maker (2.20s, Next.js/OpenNext — port login to Astro if it regresses past 2.5s).

---

## Quick reference

| Layer | Tool | Where | CI? |
|-------|------|-------|-----|
| Frontend RUM | web-vitals + PostHog | Client | No |
| API timing | Resource Timing API + PostHog | Client | No |
| Bundle size | size-limit | `.size-limit.json` | Yes (per PR) |
| Backend timing | performance.now() | API routes | No |
| PSI sweep | psi-swarm | fleet-ops/scripts | Weekly (GHA) |
| Error tracking | PostHog + onError + ErrorBoundary | Workers + frontends | No |

---

## Adding perf monitoring to a new project

- **RUM:** `pnpm add web-vitals posthog-js`, create `src/lib/vitals.ts`, call `initVitals()` in app entry
- **API timing:** copy `fleet-ops/templates/api-timing.ts` to `src/lib/api-timing.ts`, call `initApiTiming()`
- **Backend timing:** wrap handlers with `withTiming()`, verify `Server-Timing` header
- **Error handling:** Hono `app.onError()`, React `<ErrorBoundary>`, or Next.js `error.tsx` + `global-error.tsx`
