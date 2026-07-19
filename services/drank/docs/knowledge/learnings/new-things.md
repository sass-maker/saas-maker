# new-things — study queue

Short stubs for non-standard tech in this repo. 3–5 lines each. Fill `Why here:`
yourself after learning; never invent rationale.

## Ahrefs free API — User-Agent requirement
- What: Free public Domain Rating endpoint that requires a `User-Agent` header or it rejects
- Why here: TBD
- Gotcha (from code): `functions/api/dr.ts:44` — the CF Pages Function proxies the request specifically to set `User-Agent`, since the browser `fetch()` can't set it on cross-origin requests
- Source: https://ahrefs.com/api/

## Client-side opportunistic cron
- What: Weekly auto-refresh triggered by browser events (mount, tab visibility, focus, interval) instead of a server cron
- Why here: TBD
- Gotcha (from code): `lib/useTrackedDomains.ts:401-435` — triggers on mount, `visibilitychange`, `window.focus`, and a 3-hour interval — entirely client-side, no server timer
- Source: https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event

## Request pacing for free API politeness
- What: Delaying requests to avoid overwhelming free APIs with rate limits
- Why here: TBD
- Gotcha (from code): `lib/useTrackedDomains.ts:16` — `REFRESH_DELAY_MS = 750` between each domain refresh to stay within Ahrefs free tier limits
- Source: https://ahrefs.com/api/

## Next.js static export to Cloudflare Pages
- What: Using `output: 'export'` for a fully static Next.js build deployed to CF Pages
- Why here: TBD
- Gotcha (from code): `next.config.ts:4` — `output: 'export'` generates a static site; API routes don't work, so they're replaced by CF Pages Functions in `functions/api/`
- Source: https://nextjs.org/docs/app/building-your-application/deploying/static-exports

## GitHub raw JSON for live data without redeploy
- What: Fetching data from raw GitHub URLs so weekly GitHub Action updates are visible without redeploying the app
- Why here: TBD
- Gotcha (from code): `app/page.tsx:47-51` — fetches `https://raw.githubusercontent.com/High-Signal-App/drank/main/data/global-dr.json` for the live leaderboard
- Source: https://docs.github.com/en/rest/repos/contents

## CF Pages Functions as API proxy
- What: Using Cloudflare Pages Functions to replace Next.js API routes after static export
- Why here: TBD
- Gotcha (from code): `functions/api/dr.ts:1-6` — comment explains it "replaces the former Next.js /api/dr route" to bypass CORS and set required headers
- Source: https://developers.cloudflare.com/pages/functions/

## Dual data sources (static + live)
- What: Bundling static data at build time for instant render, then fetching fresh data client-side
- Why here: TBD
- Gotcha (from code): `app/page.tsx:103-163` — starts with static import from `@/data/global-sites.json`, then fetches fresh data from GitHub raw in `useEffect`
- Source: https://nextjs.org/docs/app/building-your-application/data-fetching
