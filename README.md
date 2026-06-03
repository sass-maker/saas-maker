# psi-swarm

> Lighthouse, run many times across realistic device/network presets. See the **p50 / p75 / p90 / p99** of your Web Vitals, not one noisy point.

A single PageSpeed Insights run tells you almost nothing — two runs on the same URL can disagree by 30%+ on LCP because of network jitter, CPU contention, third-party scripts, and server-side variance. `psi-swarm` runs the same audit many times across a matrix of realistic conditions and reports the **shape** of the distribution, not just one point.

## Two ways to use it

```
┌──────────────────────────────────────────────────────────────┐
│  Beautiful terminal UI  (Ink-based live progress)            │
│                                                              │
│      $ psi-swarm run https://example.com --parallel auto     │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Or:  Web UI in your browser, compute on your machine        │
│                                                              │
│  Terminal:    $ psi-swarm serve                              │
│  Browser:     http://localhost:4321                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

The CLI is the engine. The web app is a beautiful controller that drives the same engine through a tiny local HTTP server. **Compute always happens on your machine** — the browser is just the UI.

## Repo layout

```
psi-swarm/
├── cli/          ← Node CLI + headless Chrome runner + HTTP agent
│                   `psi-swarm run | discover | serve | history | compare`
└── web/          ← Astro + React + Tailwind dashboard
                    Talks to the CLI's `serve` agent via CORS
```

## Quick start — CLI only

```bash
git clone https://github.com/sarthakagrawal927/psi-swarm.git
cd psi-swarm/cli
npm install
npm run build
node dist/cli.js run https://example.com --runs 10 --parallel auto
```

See [`cli/README.md`](./cli/README.md) for the full command reference.

## Quick start — Web UI

```bash
# Terminal 1 — start the local compute agent
cd psi-swarm/cli
npm install && npm run build
node dist/cli.js serve --origin http://localhost:4321

# Terminal 2 — start the web UI
cd psi-swarm/web
npm install
npm run dev
# → open http://localhost:4321
```

The UI auto-detects the local agent. If it's not running, you get install instructions instead of a broken page.

## What's different from PageSpeed Insights / Lighthouse alone

- **Distribution, not a point.** Run N times, get p50/p75/p90/p99 + min/max/σ. PSI gives you one number per run.
- **Realistic device/network matrix.** Built-in presets for slow-3G low-end Android, slow-4G mid Android, fast-4G iPhone-class, desktop cable. Easy to mix.
- **Adaptive parallelism.** `--parallel auto` runs presets concurrently, capped at safe limits based on your machine.
- **SPA-aware link discovery.** Suggests "other pages you should test" using static HTML, sitemap.xml, Next.js `_buildManifest`, React Router patterns in the bundle, and a generic string-harvest fallback.
- **Local history.** SQLite at `~/.psi-swarm/history.db`. Tag swarms (`--tag before-deploy`) and `compare` p75/p99 across deploys.
- **Beautiful live UI** — terminal (Ink) or browser (Astro + React + Tailwind 4), same data model.

## Honest about what it is

- **Lab data.** All measurements use emulated network and CPU on a single machine. For real-user p99, use CrUX (PSI's field-data API) or a RUM tool — they capture device + network variance you genuinely can't reproduce locally.
- **INP can't be measured in lab navigation mode** — it requires real user input. The row is hidden when absent.

## Architecture diagram

```
            ┌────────────────┐
   CLI ────▶│ SwarmRunner    │ ───── spawns ─────▶ headless Chrome
            │ (event emitter)│                          │
            └───────┬────────┘                          ▼
                    │                              Lighthouse
                    ▼                                   │
            ┌────────────────┐                          ▼
            │ Ink terminal   │ ◀──── events ──── metrics + artifacts
            │ progress UI    │                       (LCP, CLS, INP,
            └────────────────┘                        TBT, FCP, TTFB,
                                                      Scripts bundle)
                    OR
                    ▼
            ┌────────────────┐    SSE     ┌─────────────────┐
            │ HTTP agent     │ ─────────▶ │ Browser web UI   │
            │ (localhost)    │            │ (Astro + React)  │
            └────────────────┘            └─────────────────┘
```

## License

MIT — see [LICENSE](./LICENSE).
