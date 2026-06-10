# drank — PROJECT STATUS

**What it is**: A beautiful, private, local-only Next.js web app for tracking Domain Rating (DR) of websites over time using Ahrefs' free public Domain Rating API.

**Core constraints (by design)**:
- 100% client-side persistence via `localStorage`
- No accounts, no backend database, no cookies for user data
- All tracked domains + full history live only in the user's browser
- Uses a tiny Next.js API route purely as a CORS-friendly proxy to `https://api.ahrefs.com/v3/public/domain-rating-free`

## Current state

**Done**
- Stunning card-based dashboard (Bento stats, responsive beautiful DomainCards with favicons, huge DR numbers, trend pills, weekly deltas, sparklines, quick actions).
- Full CRUD + search + sort + filter (All / Your sites / Popular).
- Gainers & Losers insights section computed from recent history.
- Rich animated detail modal with AreaChart + clean history table.
- Export / Import JSON (full state, including auto settings).
- Keyboard shortcuts, premium motion via framer-motion, great empty states.
- **Weekly auto "cron" for user data** (see below).

**Shared global examples + weekly auto for personal sites**
- **Global example sites** (google.com, github.com, openai.com, etc.) now use **shared historical data** stored in `data/global-dr.json`.
  - This JSON is the single source of truth for examples and is the same for every user.
  - Updated automatically by GitHub Action (`scripts/update-global-dr.mjs`) that calls the free Ahrefs public DR API weekly and appends points.
  - The Action commits the updated JSON back to the repo.
- **Your personal sites** remain 100% in localStorage with the client-opportunistic weekly auto-refresh (only triggers when you have the dashboard open/return to the tab).
- Clear visual separation in the UI: "Global Examples (shared)" at the top, "Your Sites (private + auto)" below.
- Workflow file currently lives at `drank/.github/workflows/...` — for a monorepo you will likely want to move the workflow to the repository root `.github/workflows/` and adjust paths.

**New: Leaderboard + Submit / Predict the Top**
- Beautiful **Current Leaderboard** (top ~15 ranked by live shared DR from the global JSON, with rank badges, sparklines, quick "+ Predict" buttons).
- **Nominate / "I think this will be at the top"**:
  - Users can submit any domain (via dedicated form or from leaderboard).
  - Stored in localStorage as personal predictions.
  - "My Top Predictions" panel shows each pick with its *current actual rank* from the shared leaderboard + hit rate ("X/Y in current Top 20").
  - "Share my predictions" button: opens a pre-filled GitHub issue + copies the list (users can contribute predictions to the shared pool via issues/PRs that get merged into `communityNominations` in the global JSON).
- `communityNominations` in the shared `global-dr.json` surface as "Community Nominations" chips that anyone can +Predict locally.
- This gives a fun, social "prediction market" feel for DR while keeping user data local and global data GitHub-JSON-driven.

This gives everyone consistent, rich historical trends for the example sites without any per-user server storage.

**Tech**
- Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Geist.
- framer-motion, Recharts (detail view only), lucide-react.
- Custom SVG sparklines + AreaChart in modals.
- Versioned localStorage (v2) with smooth migration from v1.

**Not done / future considerations**
- Server-side weekly crons for user data would require storing (or allowing users to register) their list of domains on a backend (e.g. Cloudflare D1 + Cron Trigger + a public "watch id"). This can be added later as an opt-in "always-fresh" mode if requested.
- No bulk edit or CSV import yet.
- Production deploy (Vercel or opennext + CF) is straightforward.

## Deployment

**Vercel (easiest and recommended)**

- Set **Root Directory** to `drank` when importing the repo.
- Next.js preset works out of the box.
- The `/api/dr` route works as a serverless function.
- Global data is bundled at build time **and** fetched fresh from GitHub raw on the client, so weekly updates from the GitHub Action are visible quickly without redeploying every time.

You can also trigger Vercel deploys from the GitHub Action using a Deploy Hook (add the hook URL as a secret).

**Alternative**: The project can also be deployed to Cloudflare Pages / Workers using the patterns from other fleet projects (`open-next` + `worker.mjs`), but Vercel gives the smoothest Next.js experience.

Run locally:
```bash
cd drank
npm run dev
```

Open http://localhost:3000

See README for full Vercel setup steps.
