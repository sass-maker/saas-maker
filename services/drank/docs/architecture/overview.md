# Architecture overview

drank is a **statically exported Next.js 16 app** deployed to Cloudflare
Pages, with two small Pages Functions providing the only dynamic surface.
All personal state lives in the browser; shared leaderboard data is public
JSON refreshed weekly by a GitHub Action.

## Topology

```
Browser (single page, app/page.tsx)
  ├── localStorage (v2 schema) ── personal domains, history, predictions, settings
  ├── /api/dr      ── Pages Function ── Ahrefs free public DR endpoint
  ├── /api/advisor ── Pages Function ── fleet free-ai gateway (DR Advisor)
  └── static build-time data + runtime fetch of raw GitHub JSON (global leaderboard)

Cloudflare Pages
  ├── out/                       (static export, output: 'export')
  ├── functions/api/dr.ts        (Ahrefs proxy)
  └── functions/api/advisor.ts   (advisor gateway, server-only secrets)

GitHub
  ├── .github/workflows/update-global-dr.yml  (weekly cron, Mondays ~04:00 UTC)
  └── data/{global,fleet}-dr.json             (shared history, committed by the cron)
```

## Key files

| Path | Role |
|---|---|
| `app/page.tsx` | The entire UI (single page). |
| `app/layout.tsx` | Root layout, metadata, JSON-LD, LCP shell, monitoring provider. |
| `app/sitemap.ts`, `app/robots.ts` | Static sitemap + robots (build-time). |
| `app/data/page.tsx` | Public `/data` page: weekly DR movers table + downloadable JSON. |
| `lib/types.ts` | `TrackedDomain`, `StoredState` (v1|v2), `Prediction`. |
| `lib/utils.tsx` | normalize, fetch, sort, colors, seed, sparkline, persistence, stats. |
| `lib/useTrackedDomains.ts` | All state + refresh logic + client-opportunistic cron. |
| `lib/dr-advisor.ts` | Advisor request/advice contracts + parsing + cache key. |
| `lib/api-timing.ts` | Client-side API call timing via Resource Timing API → PostHog. |
| `lib/foundry-monitoring.ts` | PostHog crash/error capture. |
| `components/DrAdvisor.tsx` | Advisor panel (idle/loading/cached/success/retry states). |
| `components/DrHistoryChart.tsx` | Recharts AreaChart for the detail modal. |
| `functions/api/dr.ts` | Ahrefs proxy (CORS bypass + User-Agent). |
| `functions/api/advisor.ts` | DR Advisor gateway call (server-only credentials). |
| `data/global-sites.json` | Seed list of ~45 global example sites. |
| `data/global-dr.json` | Shared weekly DR history (committed by the cron). |
| `data/fleet-sites.json`, `data/fleet-dr.json` | Fleet-owned domains, same shape. |
| `scripts/update-global-dr.mjs` | Cron script: fetch + append + commit. |

## Storage model

Personal state is a single `StoredState` object under `localStorage` key
`drank:v1` (schema versioned `1 | 2`; v2 added auto-refresh + predictions).
See `lib/types.ts` for the authoritative shape. The advisor cache lives
under a separate key `drank:advisor:v1` keyed by a measurement bucket (see
[ADR-0003](decisions/0003-dr-advisor-server-side-gateway.md)).

## Data flow

- **Personal domains**: client calls `/api/dr?target=` → Pages Function →
  Ahrefs → DR number appended to local history.
- **Global leaderboard**: bundled at build time from `data/global-dr.json`
  for instant render, then re-fetched at runtime from the raw GitHub URL so
  weekly cron updates appear without redeploy.
- **DR Advisor**: explicit Explain action → `POST /api/advisor` with a
  bounded request → gateway → structured, validated advice → cached locally.

## Dynamic surface (why Pages Functions, not Next API routes)

`output: 'export'` produces a fully static build; Next API routes do not run.
The two dynamic endpoints are therefore implemented as Cloudflare Pages
Functions under `functions/api/`, served at the same paths (`/api/dr`,
`/api/advisor`) by `wrangler pages deploy`. See
[ADR-0004](decisions/0004-pages-functions-as-api-proxy.md).

## Monitoring

- PostHog crash/error capture via `lib/foundry-monitoring.ts` (initialized in
  `app/monitoring-provider.tsx`).
- Client-side API call timing via the Resource Timing API
  (`lib/api-timing.ts`), emitting `api_call_timing` events with p50/p90/max
  duration + TTFB. This captures full round-trip latency the backend cannot
  measure. Limitation: Resource Timing does not expose HTTP status for
  fetch/XHR, so latency-by-status is unavailable.

## Decisions

Recorded decisions live in [decisions/](decisions/). Read them before
changing the corresponding system; they capture non-obvious constraints and
the reasons the current shape was chosen.
