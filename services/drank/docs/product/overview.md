# Product overview

**drank** — track Domain Rating of popular websites and your own, 100% in
your browser. Product: <https://domains.sassmaker.com>.

## What it is

A single-page Next.js dashboard that uses Ahrefs' free public Domain Rating
API. Everything personal (your sites, history, settings, predictions) lives
in `localStorage`. No sign-up, no server storage of user data.

## Who it's for

- SEO practitioners tracking personal domains over time.
- Community members nominating/predicting top sites.
- High Signal readers using the `/domains` lens at
  <https://highsignal.app/domains>, which consumes drank's shared global DR
  history and community nominations.

## Two sections

1. **Global Examples** (shared, identical for all users) — ~45 popular sites
   with rich historical DR data from `data/global-dr.json`, maintained by a
   weekly GitHub Action. Includes a ranked **Current Leaderboard**.
2. **Your Sites** (private, localStorage + weekly auto when the tab is open) —
   domains you add are marked `isCustom` and become eligible for weekly
   auto-refresh.

## The cron situation (important)

Real background server crons cannot touch per-user `localStorage`. drank
solves this the local-first way:

- Only your explicitly added sites participate.
- Refresh triggers on load, visibility/focus, and a light poll.
- Clear UI status ("Next in ~4d") + manual "Run now" + on/off toggle.

If you ever want true always-on server cron updates for personal lists, that
requires opt-in server-side storage (e.g. Cloudflare D1 + a watch id). See
[the deferred work in PROJECT_STATUS.md](../../PROJECT_STATUS.md).

## How it works

1. First load → beautiful seed of popular domains (marked as non-custom).
2. Add your sites → marked `isCustom`, eligible for weekly auto.
3. The scheduler + manual refresh call `/api/dr` (a Cloudflare Pages
   Function) → Ahrefs free public endpoint.
4. Every measurement is appended to history in `localStorage`.
5. All visuals (cards, charts, insights) derive 100% from local data.

Data never leaves the browser except for the actual public DR lookup.

## DR Advisor

An explicit **Explain** action on a domain's history calls a second Pages
Function (`/api/advisor`) that asks the fleet free-ai gateway for a
conservative, structured read on the observed DR + trend. Generation is
explicit (opening history never calls AI), output is validated at both
boundaries, and successful advice is cached in `localStorage`. See
[the DR Advisor ADR](../architecture/decisions/0003-dr-advisor-server-side-gateway.md).

## Respecting the free API

"Refresh all" waits ~750 ms between requests. If you hit rate limits you see
friendly toasts. The endpoint is generous for a free public API but still has
normal protection. See
[the request-pacing ADR](../architecture/decisions/0006-request-pacing.md).

## Integration with High Signal

The core dataset and leaderboard from drank power a first-class lens inside
[High Signal](https://highsignal.app/domains):

- Shared global DR history and community nominations are consumed by
  highsignal.app.
- The full interactive experience (personal predictions, local tracking,
  detailed history) lives here as the standalone companion tool.
- Data stays in the public GitHub JSON + GitHub Action pipeline for easy
  cross-product reuse.

## Tech notes

- Next.js 16 App Router + TypeScript + Tailwind v4 + Recharts + framer-motion.
- Recharts only for the big history chart in the modal; table sparklines are
  tiny custom SVGs.
- One Cloudflare Pages Function (`functions/api/dr.ts`) proxies Ahrefs (CORS
  bypass + friendly User-Agent). A second (`functions/api/advisor.ts`) hosts
  the DR Advisor gateway call.

See [architecture overview](../architecture/overview.md) and
[development workflow](../development/workflow.md) for the rest.
