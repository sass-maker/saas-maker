# drank

**Product:** [domains.sassmaker.com](https://domains.sassmaker.com)


**Track Domain Ratings of popular websites and your own — 100% in your browser.**

A beautiful, private Next.js dashboard that uses Ahrefs’ free public Domain Rating API. Everything (your sites, history, settings) lives in localStorage.

- No sign-up, no server storage
- Stunning card UI with big DR numbers, sparklines, weekly trends, gainers/losers
- **Weekly auto-refresh for the sites you add** (client-opportunistic "cron" — see below)
- Export / import your full data as JSON

## Features

- Two clear sections + new social features:
  - **Global Examples** (shared): ~45 popular sites with rich historical DR data that is **identical for all users** (from `data/global-dr.json`, maintained by weekly GitHub Action).
  - **Current Leaderboard**: Ranked view of the shared globals (with quick "Predict" buttons).
  - **Your Sites** (private, localStorage + weekly auto when open).
  - **Predict the Top / Submit contenders**: Nominate any site you think will rise. Your predictions are scored live against the actual shared leaderboard ("X of your picks are in the current Top 20"). "Share my predictions" generates a GitHub issue + copyable list so the community can merge good nominations into the shared `communityNominations`.
- Beautiful Domain Cards, Bento stats, Gainers/Losers, premium modals.
- Export/Import your personal data + predictions as JSON.

## The "cron" situation (important)

Real background server crons cannot touch per-user localStorage. 

We solved it the right way for a local-only product:
- Only your explicitly added sites participate.
- Triggers intelligently on load, visibility/focus, and a light poll.
- Clear UI status ("Next in ~4d") + manual "Run now" + on/off toggle.

If you ever want true always-on server cron updates for your personal list, that would require a small amount of server-side storage (e.g. Cloudflare + a watch token) and can be added as a future opt-in mode.

## How it works

1. First load → beautiful seed of popular domains (marked as non-custom).
2. Add your sites → they are marked `isCustom` and become eligible for weekly auto.
3. The scheduler + manual refresh buttons call the `/api/dr` proxy (Cloudflare Pages Function) → free Ahrefs public endpoint.
4. Every measurement is appended to history in localStorage.
5. All visuals (cards, charts, insights) are derived 100% from your local data.

Data never leaves your browser except for the actual public DR lookup.

## Getting started

```bash
cd drank
pnpm install    # repo pins pnpm@10.33.2 via packageManager
pnpm dev
```

Open http://localhost:3000

## Using the data elsewhere

Click **Export** — you get a clean JSON file with your full state.

You can import it on any other browser/device running drank.

## Tech notes

- Next.js 16 App Router + TypeScript + Tailwind v4
- Recharts only for the big history chart in the modal (table sparklines are tiny custom SVGs)
- Two Cloudflare Pages Functions: `functions/api/dr.ts` (Ahrefs proxy — solves CORS + sets a friendly User-Agent) and `functions/api/advisor.ts` (server-side DR Advisor gateway call)

## Respecting the free API

"Refresh all" deliberately waits ~750 ms between requests. If you hit rate limits you will see friendly toasts. The endpoint is generous for a free public API but still has normal protection.

## License / credit

Built for personal / fleet use. Domain Rating data © Ahrefs. The free public endpoint is documented at:

https://docs.ahrefs.com/en/api/reference/public/get-domain-rating-free

## Deploy to Cloudflare Pages

This app is client-side only (localStorage, no server DB) and uses Next.js
static export (`output: 'export'` → `out/`). The `/api/dr` and `/api/advisor`
endpoints are served as Cloudflare Pages Functions (`functions/api/dr.ts`,
`functions/api/advisor.ts`).

1. Push your code to GitHub (the `drank` folder can live inside a monorepo).
2. Create a Cloudflare Pages project named `drank` (or update `wrangler.toml` /
   the `deploy` script to match your project name).
3. Build & deploy locally:
   ```bash
   pnpm deploy    # builds then runs wrangler pages deploy out --project-name=drank
   ```
   Or let CI handle it — the `ci.yml` workflow deploys `out/` on push to `main`
   using `CLOUDFLARE_API_TOKEN` from repo secrets.

The app works great on Cloudflare Pages:
- The `/api/dr` proxy runs as a Pages Function (CORS bypass + friendly User-Agent).
- All global leaderboard data is loaded at build time + refreshed at runtime from the raw GitHub JSON (so weekly Action updates appear without manual redeploys).
- User data and predictions stay 100% in the browser (localStorage).

See the GitHub Action in `.github/workflows/` (move to repo root `.github` if this is part of a larger monorepo).

## Project layout (key files)

```
app/
  page.tsx            # the entire UI
functions/
  api/dr.ts           # Cloudflare Pages Function — proxy to Ahrefs free DR endpoint
  api/advisor.ts      # Cloudflare Pages Function — server-side DR Advisor gateway call
lib/
  types.ts
  utils.tsx           # normalize, fetch, sort, colors, seed list, sparkline, persistence
  useTrackedDomains.ts# all the state + refresh logic
  dr-advisor.ts       # advisor request/advice contracts + parsing (shared client/function)
data/
  global-sites.json
  global-dr.json      # shared history, updated by GitHub Action
```

See [PROJECT_STATUS.md](./PROJECT_STATUS.md) for current state and deferred work.

## Integration with High Signal

The core dataset and leaderboard from drank power a first-class lens inside [High Signal](https://highsignal.app/domains).

- Shared global DR history and community nominations are consumed by highsignal.app
- The full interactive experience (personal predictions, local tracking, detailed history) lives here as the standalone companion tool.
- Data stays in the public GitHub JSON + GitHub Action pipeline for easy cross-product reuse.
- Integrated as the `/domains` lens inside https://highsignal.app (web authority leaderboard + community nominations).
