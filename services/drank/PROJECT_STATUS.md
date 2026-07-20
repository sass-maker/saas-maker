# drank — PROJECT STATUS
Last updated: 2026-07-18

## Why / What

**drank** is a private, local-only Next.js dashboard for tracking Domain Rating (DR) over time via Ahrefs' free public API. Product thesis: beautiful DR tracking with zero sign-up — personal data stays in the browser; global leaderboard data is shared via public JSON.

**Users:** SEO practitioners tracking personal domains; community members nominating/predicting top sites; High Signal readers using the `/domains` lens.

**Constraints:** Real background server crons cannot touch per-user `localStorage`. Weekly personal refresh is client-opportunistic (runs when tab is open). Ahrefs free API rate limits (~750ms between bulk refreshes).

**IN scope:** Single-page dashboard (`app/page.tsx`), `/api/dr` and `/api/advisor` Pages Functions, global JSON pipeline, High Signal integration.

**OUT of scope:** Production deploy (straightforward but not blocking local use), server-side personal domain storage without explicit opt-in.

## Dependencies

### External

- **Ahrefs free public API:** Domain Rating endpoint proxied via `/api/dr`; ~750ms between bulk refreshes; no API keys.
- **GitHub Actions:** weekly global DR update cron.
- **Cloudflare Pages:** deploy target (static export via `output: 'export'`, served from `out/`; `/api/dr` runs as a Pages Function).

### Internal (fleet)

- **High Signal:** `/domains` lens imports global DR history + `communityNominations` from drank's shared pipeline (https://highsignal.app/domains).
- **free-ai:** optional server-side DR Advisor generation through the existing gateway; successful advice remains browser-local.

### Stack & commands

**Stack:** Next.js 16 App Router + React 19 + TypeScript + Tailwind v4 + Recharts + framer-motion; versioned localStorage (v2). No database, no auth.

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install deps (pnpm 10+; repo pins `pnpm@10.33.2`) |
| `pnpm dev` | Dev server → http://localhost:3000 |
| `pnpm build` | Production build (`next build --webpack` → `out/`) |
| `pnpm start` | Production server (rarely used; we deploy static `out/`) |
| `pnpm lint` / `pnpm check` | Biome check (`biome check .`; no ESLint) |

**Deploy:** Cloudflare Pages — `pnpm deploy` (builds then `wrangler pages deploy out --project-name=drank`); CI auto-deploys on push to `main` via `CLOUDFLARE_API_TOKEN`.

**Env files:** None required. No secrets.

## Timeline

- **2026-07-13** — Shipped DR Advisor on the current Cloudflare Pages architecture: explicit, structured explanations grounded only in observed DR/trend, browser-local caching, and fail-closed server-side gateway credentials.
- **2026-07-02** — Added Next.js error boundaries (`app/error.tsx`, `app/global-error.tsx`); removed dead `web-vitals` dependency and unused vitals files.
- **Weekly (Mondays ~04:00 UTC)** — GitHub Action `update-global-dr.yml` runs `scripts/update-global-dr.mjs`, commits `data/global-dr.json`.
- **Shipped** — Global example sites (~45), nomination/prediction flow, client-opportunistic weekly personal refresh, High Signal `/domains` integration, Ahrefs proxy API.

## Products

- **Standalone dashboard:** single-page app (`app/page.tsx`); deploys to Cloudflare Pages (static export). Also runs locally at http://localhost:3000.
- **Shared data pipeline:** `data/global-dr.json` + `data/global-sites.json` — ~45 global example sites; fetchable from raw GitHub JSON at runtime.
- **High Signal lens:** https://highsignal.app/domains — consumes global DR history + community nominations; full interactive experience (personal predictions, local tracking, detailed history) remains in drank standalone.

## Features (shipped)

### Core dashboard (`app/page.tsx`, `lib/`)

- Card-based UI: Bento stats, DomainCards, sparklines (custom SVG), trend pills, search/sort/filter.
- Full CRUD for personal domains; rich detail modal with Recharts AreaChart + history table.
- Export/import personal data as JSON; keyboard shortcuts; framer-motion animations; empty states.
- Gainers & Losers section; premium modals; friendly rate-limit toasts (~750ms between bulk refreshes).
- Two sections: **Global Examples** (shared, non-custom) and **Your Sites** (private, `isCustom`).

### Architecture & storage

- All personal domains, history, predictions, settings in browser `localStorage` (v2 schema via `lib/useTrackedDomains.ts`).
- Global example sites (~45) load from `data/global-dr.json` — identical for all users, updated weekly by GitHub Action.
- Client calls `/api/dr?target=` → Cloudflare Pages Function (`functions/api/dr.ts`) proxies Ahrefs free endpoint with friendly User-Agent (CORS bypass).
- Global data also fetchable from raw GitHub JSON at runtime (no redeploy needed for DR updates).
- No auth, no server storage of user data.

### Global & social

- Global example sites (~45) with shared `data/global-dr.json` history.
- Weekly GitHub Action (`.github/workflows/update-global-dr.yml`): Mondays ~04:00 UTC, runs `scripts/update-global-dr.mjs`, commits `data/global-dr.json`.
- `data/global-sites.json` seed list; `communityNominations` merged from community predictions.
- Current Leaderboard (top ~15 ranked globals).
- Nomination/prediction flow: nominate contenders, live scoring against actual leaderboard ("X of your picks in Top 20").
- "Share my predictions" generates GitHub issue + copyable list for community merge.

### Personal refresh scheduler (`lib/useTrackedDomains.ts`)

- Client-opportunistic weekly auto-refresh for user-added (`isCustom`) domains only.
- Triggers on load, visibility/focus, light poll.
- UI status ("Next in ~4d"), manual "Run now", on/off toggle.

### API proxy (`functions/api/dr.ts`)

- Cloudflare Pages Function that proxies Ahrefs free Domain Rating endpoint: https://docs.ahrefs.com/en/api/reference/public/get-domain-rating-free
- Solves CORS; sets friendly User-Agent. Served at `/api/dr` by `wrangler pages deploy`.

### DR Advisor (`functions/api/advisor.ts`, `components/DrAdvisor.tsx`)

- Explicit Explain/Regenerate action in domain history; opening a domain never calls AI.
- Uses only normalized domain, current DR, and bounded trend context.
- Strict structured output separates measurement interpretation, evidence limits, and 3–5 prioritized general actions.
- Gateway keys stay in the Pages Function environment; valid responses are cached only in browser localStorage.
- Missing configuration, rate limits, provider errors, and invalid output leave normal DR tracking available.

### Key files

- `app/page.tsx` — entire UI (single page).
- `lib/types.ts`, `lib/utils.tsx` — normalize, fetch, sort, colors, seed, sparkline, persistence.
- `lib/useTrackedDomains.ts` — state + refresh logic.
- `data/global-sites.json`, `data/global-dr.json` — shared history.

## Todo / Planned / Deferred / Blocked

### Planned

1. Move GitHub Action workflow to monorepo root `.github/workflows/` (currently under `drank/.github/workflows/update-global-dr.yml`).
2. Optional opt-in server-side weekly cron (D1 + watch id) for always-fresh personal domains.
3. Bulk edit or CSV import for personal domain lists (`lib/useTrackedDomains.ts`).
4. Deploy to Cloudflare Pages (`pnpm deploy` or via CI).

### Deferred

- Production deploy to Cloudflare Pages — config and CI are ready; manual `wrangler pages deploy` (or CI push to `main`) when ready.
- Any backend that stores user domain lists without explicit opt-in design.
- True always-on server cron for personal lists (requires opt-in server storage).

### Blocked

- Real background server crons cannot touch per-user localStorage — weekly refresh only when tab is open.
- GitHub Action lives under project-local `.github/` rather than fleet monorepo root.
- Limited test coverage (vitest configured, `lib/utils.test.ts` exists); manual smoke on add/refresh/export flows.
