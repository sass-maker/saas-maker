# Command Reference

Canonical command list. The source of truth for npm scripts is
`package.json`; this table mirrors it grouped by purpose. Render modes and
their requirements live in
[`architecture/render-modes.md`](../architecture/render-modes.md).

## Local API & dev

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local control API (`src/server/index.js`, port 4317) |
| `npm run dev` → `/` | Anonymous one-field brand URL → status → reviewed MP4 preview/download |
| `npm run dev` → `/review` | Swipe review UI |
| `npm run dev` → `/studio` | Content studio web UI |

## Tests & smokes

| Command | Purpose |
| --- | --- |
| `npm test` | Node `--test` + `cargo test` |
| `npm run test:coverage` | Node tests with coverage thresholds |
| `npm run smoke:mock` | No-dependency end-to-end smoke |
| `npm run smoke:full` | Full pipeline smoke (manual posting fallback) |
| `npm run smoke:generation-cases` | Top-level readiness: marketing modes, Worker render-pro, lesson CLI, creator packets |
| `npm run smoke:render-modes` | Fixture-backed readiness for local/no-credential render modes |
| `npm run smoke:reel-maker` | reel-maker/Remotion adapter smoke |
| `npm run smoke:artifact` | Live R2 artifact byte-range playback smoke |
| `npm run smoke:studio` | Content studio offline smoke (13 checks) |
| `npm run smoke:lesson-local` | Lesson lifecycle with fake adapters |
| `npm run smoke:significant-content` | Offline versioned handoff/idempotency/receipt/performance proof |

## Readiness gates

| Command | Purpose |
| --- | --- |
| `npm run check:generation-readiness` | Consolidated current-evidence report → `tmp/generation-readiness/report.json` |
| `npm run check:generation-readiness -- --refresh --strict` | Refresh every refreshable proof, then validate |
| `npm run ready:local` | One-command local smoke (`smoke:generation-cases`) |
| `npm run ready:proofs` | Refreshed required-proof gate (`--refresh --strict`) |
| `npm run ready:target` | Final target-host acceptance (`--refresh --strict --fail-unresolved`) |

See [`operations/runbooks/generation-readiness.md`](../operations/runbooks/generation-readiness.md).

## Render

| Command | Purpose |
| --- | --- |
| `npm run render:pro` | Canonical production render (`node scripts/render-pro.js`) |
| `npm run render:pro:rs` | Rust production render (`reel render --execute`) |
| `npm run render:accepted -- --mode <mode> --limit N` | Render accepted SaaS Maker queue items |
| `npm run render:html -- --brief brief.json --artifact-dir artifacts/html` | Export HTML/CSS preview artifacts |
| `npm run render:package -- --file approved-package.json --out artifacts/brand-video` | Render an approved content package |
| `npm run render:reel-maker` | reel-maker/Remotion adapter |
| `npm run moneyprinter:api` | Start MoneyPrinterTurbo API on `127.0.0.1:18080` |
| `npm run canary:moneyprinter` | MoneyPrinterTurbo real-MP4 canary |
| `npm run probe:engines` | Verify real-render prerequisites without rendering |

## Watch / autopilot / post

| Command | Purpose |
| --- | --- |
| `npm run watch:render` | Production watcher (`reel watch --execute`) |
| `npm run watch:render:once` / `:dry` | One-shot / dry-run watcher |
| `npm run autopilot:dry` | Rust marketing autopilot dry-run (`reel autopilot`, prints intended actions). Execute with `cargo run --manifest-path reel/Cargo.toml -- autopilot --execute --repo-root .` |
| `npm run autopilot` / `:once` | Node content-package control tick (`marketing-control.js tick`) — sync-source content flow, not the SaaS Maker reel autopilot |
| `npm run post:ready` | Post ready reels (`reel post --execute`) |
| `npm run sync:metrics` | Backfill YouTube/Instagram metrics (`reel metrics --execute`) |
| `npm run sync:saasmaker` | Sync from SaaS Maker |
| `npm run draft:signal` | Convert a High Signal brief fixture into a reviewable draft bundle |
| `npm run marketing` | Marketing control (sync / tick) |
| `npm run distribution` | Prepare/execute a distribution request |
| `npm run content` | Content package extract/sync |

## Studio / faceless / factory / lessons

| Command | Purpose |
| --- | --- |
| `npm run studio -- <tool>` | Content studio: ideas, titles, descriptions, tags, scripts, voice, keywords, transcripts, thumbnails, ideas manager |
| `npm run faceless -- --topic "..."` | Topic → script → brief → rendered faceless video (batch via `--topics-file`; engines mock/kokoro/moneyprinterturbo) |
| `npm run factory -- plan/produce/status` | Backlog conveyor: plan ideas → produce renders with quality gate + publish packet |
| `npm run significant-content -- validate/import/status/receipt/report/follow-up` | Local Significant Hobbies handoff, receipt, status, and draft-only performance loop |
| `npm run lesson:render -- --input test/fixtures/lessons/closures.json --auto-approve` | Tutoring lesson pipeline |
| `npm run setup:kokoro` | One-time local Kokoro-82M TTS install (venv + ~340MB model) |

## OAuth & Cloudflare

| Command | Purpose |
| --- | --- |
| `npm run yt:bootstrap` | YouTube OAuth bootstrap (mints refresh token) |
| `npm run ig:bootstrap` | Instagram OAuth bootstrap (mints long-lived token + user id) |
| `npm run ig:refresh` | Refresh Instagram long-lived tokens |
| `npm run bootstrap:cloudflare` | Cloudflare Worker + R2 setup |
| `npm run check:cloudflare` | Cloudflare readiness check |
| `npm run worker:dry-run` | `wrangler deploy --dry-run` |
| `npm run check:social` | Social account routing readiness |

## Rust CLI surface

```
reel render <reelId...> [--variant-count N] [--execute]   # production path; dry-run by default
reel watch [--worker-url URL] [--once] [--execute]        # auto-render-watcher equivalent
reel autopilot [--once] [--execute] [--fixture path]      # marketing-autopilot equivalent
reel render-accepted [--execute] [--fixture path] [--mode MODE] # render accepted marketing posts
reel post [--execute] [--posting-provider auto|manual]    # post ready marketing videos
reel metrics --execute                                    # backfill provider metrics
reel plan <brief.json> [--variant-count N]                # preview templates + hooks
reel validate-brief <brief.json>                          # VideoBrief lint
reel score <brief.json>                                   # quality heuristics
reel config <project-urls|social-accounts>                # inspect resolved config
```

`render`/`watch`/`autopilot`/`post` print intended actions unless `--execute`
is passed. Use `--posting-provider manual` for dry-run-style "prepared"
outcomes without API calls.

## Docs

| Command | Purpose |
| --- | --- |
| `npm run docs:validate` | Validate docs structure + internal markdown links (no Blume install needed) |
| `npm run docs:links` | Blume link validation (requires `blume`) |
| `npm run docs:dev` | Blume dev server (requires `blume`) |
| `npm run docs:build` | Blume static build to `dist/` (requires `blume`) |

See [`docs-build.md`](./docs-build.md) for the Blume setup.
