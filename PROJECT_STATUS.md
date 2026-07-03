# Project Status

Last updated: 2026-07-03 (v0.4.0)

## Why / What

psi-swarm is a local-first website performance tracker. It measures Web Vitals
across repeated Lighthouse runs and realistic device/network presets so users
can reason about p50, p75, p90, and p99 instead of trusting one noisy
PageSpeed/Lighthouse result.

In scope: lab measurement via headless Chrome + Lighthouse, local history and
comparisons, a local browser controller, and optional AI reasoning over
results. Out of scope (see section 6): hosted RUM, cloud execution, paid
monitoring/alerting.

## Dependencies

External:
- **Lighthouse 12** (`lighthouse`) — the measurement engine. Known
  incompatibility with Node 24 (TraceEngineResult performance mark), hence the
  `node >=20 <24` engines pin; Node 22 LTS is the supported path.
- **Headless Chrome** via `chrome-launcher` — runs the Lighthouse audits.
- **better-sqlite3** — local run history, watchlist, insights, and DR cache
  (SQLite on disk).
- **Optional reasoning backends** (`--reason-backend openai | local-ai | auto`):
  any OpenAI-compatible Chat Completions endpoint (OpenAI, OpenRouter, Groq,
  own gateway) or the local-ai CLI wrapper at `http://localhost:3456`.
- **Ahrefs free public DR endpoint** — Domain Rating for custom-domain
  projects (skipped for `*.pages.dev` / `*.workers.dev`).
- **Cloudflare Pages** — hosts the static web app (`psi-swarm-web`), deployed
  via `cloudflare/wrangler-action@v3` on GitHub Actions (wrangler pinned as a
  `web` devDependency).
- CLI UX: `commander`, `ink` + React 19, `chalk`, `boxen`, `cli-table3`, `ora`.
- Web app: Astro 5 + React 19 + Tailwind v4 (`@tailwindcss/vite`), static build.
- Tooling: pnpm workspaces (`pnpm@10.33.2`), TypeScript 5.7, tsx.

Internal (fleet):
- **SaaS Maker auth hub** — CLI device-flow helper (`connect` / `whoami`)
  stores fleet Cockpit tokens.
- **local-ai** — optional dev-time reasoning bridge (out-of-fleet service).
- Claude/Codex usage paths documented via the installable skill
  (`scripts/install-skill.mjs`) and AGENTS guidance notes.

## Timeline

- **2026-06-03/04** — core build-out: `/projects` fleet dashboard backed by
  local SQLite history, Astro/React HTML reports (self-contained files),
  multi-page projects grouped by URL origin, `coverage` preset/profile for
  global device representation, inline "analysis →" report links; first
  PROJECT_STATUS.
- **2026-06-05** — logged fleet perf-push follow-ups; fleet-wide CF Cache
  Rules deployer; removed one-off Pages-cleanup workflow.
- **2026-06-09** — evaluated OSS performance-tool integrations
  (`docs/oss-integration-evaluation.md`).
- **2026-06-10** — Ahrefs Domain Rating in reports, projects dashboard, and
  weekly idle refresh; hardened with negative caching, fetch timeouts, and
  UI states.
- **2026-06-12/13** — shipped v0.4.0: three PRDs (watchlist, demo gallery,
  trace insight) plus correctness fixes (report-URL decoding, waiting for
  project runs, dashboard run-subscription cleanup).
- **2026-06-19** — continue-on-error for batch page runs with per-page
  failure reporting; committed `docs/learning/` notes.
- **2026-06-20** — SaaS Maker auth hub (device-flow `connect`/`whoami`, PR #6);
  migrated npm workspaces to pnpm (PR #8).
- **2026-06-22** — made psi-swarm standalone OSS, decoupled from saas-maker
  (PR #9).
- **2026-06-26** — agent auto-probe gated to localhost/explicit intent
  (PR #10); manual redeploy promoted the fix to prod; CI deploy added
  (PRs #11–#14).
- **2026-06-28** — repo transferred to `sarthak-fleet` org (unblocking CF org
  secrets); README npm→pnpm fixes + AGENTS.md (PR #17).
- **2026-07-02** — guarded manual deploy command (`pnpm deploy` →
  `scripts/manual-deploy.mjs`).

## Products

- **CLI (`cli/`)** — `psi-swarm` Node CLI (npm-publishable package, v0.4.0)
  with `run`, `discover`, `serve`, `history`, `compare`, `watch`, `connect`,
  and `whoami` workflows. Compute stays local.
- **Local web controller (`web/`)** — Astro + React + Tailwind browser UI for
  the CLI `serve` agent, talking to it over CORS/SSE.
- **Deployed web app** — static Astro build on the Cloudflare Pages project
  `psi-swarm-web` (https://psi-swarm-web.pages.dev). Build:
  `pnpm --filter psi-swarm-web run build` → `web/dist`. Includes a static
  `/gallery` demo that works without the local agent.
- **CI/CD** — `.github/workflows/deploy.yml` builds the web workspace with
  pnpm and deploys `web/dist` via `cloudflare/wrangler-action@v3` on push to
  `main` (paths `web/**`) + manual dispatch. The action runs from
  `workingDirectory: web` with the locally pinned wrangler (the action's own
  install fails inside this pnpm monorepo). Repo-local guarded deploy:
  `pnpm deploy`.
- **Installable skill** — `pnpm install:skill` installs the Claude/Codex skill
  documenting usage paths.

Deploy history note (2026-06-26): PR #10 had merged but the live site still
served the pre-fix build — psi-swarm had no deploy automation at the time. The
main build was rebuilt and deployed manually; the live bundle now carries the
`shouldAutoProbeAgent` localhost gate, so a bare deployed page load no longer
fires failed `127.0.0.1:7777/7778` requests. CI deploy was added the same day.

## Features (shipped)

Measurement engine:
- Headless Chrome + Lighthouse runs produce percentile tables (p50/p75/p90/p99),
  LCP element identification, ranked opportunities, and static HTML reports.
- Realistic device/network presets, including the `coverage` preset/profile.
- Batch page runs continue on error with per-page failure reporting.
- OSS integration decision: keep Lighthouse as the engine; prefer an optional
  Chrome DevTools trace-insight adapter before adopting a heavier
  sitespeed/WebPageTest-style stack (`docs/oss-integration-evaluation.md`).

History & analysis (SQLite):
- Local run history with tagged runs and before/after comparisons.
- **Trace insight adapter (PRD shipped):** saved swarms export Lighthouse
  bundles to `~/.psi-swarm/artifacts/`, derive a builtin diagnosis into
  `run_insights`, render it in CLI/HTML reports, and expose `/api/insights`.
  External adapter hook: `~/.psi-swarm/adapters/trace-insight.mjs` or
  `PSI_TRACE_INSIGHT_ADAPTER`.
- **Local regression watchlist (PRD shipped):** `watchlist` table, `psi-swarm
  watch` subcommands, `/api/watchlist` endpoints, `/watchlist` web UI.
- Ahrefs Domain Rating for custom-domain projects in `/projects`, CLI, and
  HTML reports; CF platform hostnames skipped (DR not meaningful on shared CF
  subdomains); ratings persist in SQLite; `serve` refreshes weekly when idle
  (no active swarms), probed hourly.

Web controller & sharing:
- Astro + React + Tailwind local browser UI for the `serve` agent (CORS/SSE).
- **Shareable demo gallery (PRD shipped):** static fixtures + `/gallery` route
  — works without the local agent.
- Agent auto-probe only fires on localhost or explicit `?agent=`/`?token=`
  intent (no failed `127.0.0.1` requests on the deployed site).

Fleet & tooling:
- SaaS Maker auth hub: CLI device-flow `connect` / `whoami` for fleet Cockpit
  token storage.
- Optional AI reasoning via local-ai or any OpenAI-compatible backend.
- pnpm workspaces as canonical package manager (root scripts/docs updated).
- Installable skill + AGENTS guidance for Claude/Codex usage.
- Standalone OSS: decoupled from saas-maker, MIT-licensed.

## Todo / Planned / Deferred / Blocked

Planned next:
1. Keep Node 22 LTS as the supported path until the Lighthouse 12 / Node 24
   trace-mark issue is resolved.
2. Improve the local web controller so users can run, compare, and inspect
   swarms without dropping to the CLI.
3. Validate an external trace-insight adapter against a small set of known
   regressions (Chrome DevTools MCP path).

Fleet Perf Push 2026-06 — open follow-ups (from the 2026-06-04/05 fleet
desktop-LCP push, goal <500 ms p75 across all 23 sites; the push closed 5
sites under 500 ms via the Worker + Astro overlay pattern, self-hosted fonts,
opacity-anim LCP fixes, CF Cache Rules, and `caches.default` data wrapping;
the remaining gap is being closed at the app level — Argo (cost) and Vercel
(external dep) are off the table):
4. **Knowledgebase landing site** — build Astro frontend for the
   FastAPI+Qdrant RAG at `fleet/knowledgebase/`. Not perf-critical; tracked
   here because it completes the fleet inventory.
5. **psi-swarm × saas-maker integration** — wire this CLI into the saas-maker
   fleet workflow so desktop LCP samples flow into Cockpit dashboards. Spec
   notes move up to "Planned next" once started.
6. **Beasties critical-CSS pass** — high-signal Beasties-only pass on
   saas-maker cockpit + sarthakagrawal.dev. Both have dynamic `/` so the Astro
   overlay does not apply; only the Beasties half is safe. Expected
   ~150–300 ms LCP win.

Deferred / parked:
- Hosted RUM or real-user p99 collection — psi-swarm is lab data, not a RUM
  replacement.
- Cloud execution — compute is intentionally local for now.
- Paid monitoring, team accounts, and alerting — deferred behind a stronger
  local workflow.
- **Custom-domain Worker TTFB floor** (intentional, do not re-open without a
  budget decision) — CF Workers/Pages on custom domains floor at 400–1000 ms
  TTFB in Lighthouse cold-sim without Argo Smart Routing. User ruled out both
  Argo ($5/mo) and Vercel (external dep). Workers.dev URLs hit <500 ms;
  custom domains do not.

Blocked:
- (none — repo transferred to `sarthak-fleet` org; org secrets now available)
