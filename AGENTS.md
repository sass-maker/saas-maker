# reel-pipeline

AI reel generation and autopost orchestration for fleet products. Turns
approved SaaS Maker marketing ideas, High Signal briefs, Significant Hobbies
envelopes, and public brand URLs into reviewable short-form video drafts,
rendered MP4s, and gated posting handoff.

## Shared Fleet Standard

Also read and follow the shared fleet-level agent standard at `../AGENTS.md`.
Treat this repository as owned product code: protect production stability,
keep changes scoped, verify work, and record durable follow-up tasks when
something remains incomplete or blocked.

## Essential commands

```bash
npm ci                              # install (Node ≥ 20; Rust stable for reel/)
npm test                            # node --test + cargo test
npm run dev                         # local control API on :4317 (root = anonymous brand reel)
npm run smoke:mock                  # no-dependency end-to-end smoke
npm run ready:local                 # top-level generation-cases readiness
npm run ready:target                # final target-host acceptance gate
npm run watch:render                # production watcher (reel watch --execute)
npm run autopilot:dry               # Rust marketing autopilot dry-run (execute: cargo run --manifest-path reel/Cargo.toml -- autopilot --execute --repo-root .)
npm run render:pro -- <reel-id>     # canonical production render
npm run post:ready                  # post ready reels (reel post --execute)
npm run docs:validate               # validate docs structure + internal links
```

Full command reference: [`docs/development/commands.md`](docs/development/commands.md).
Render modes: [`docs/architecture/render-modes.md`](docs/architecture/render-modes.md)
and `config/render-modes.json`.

## Critical constraints

- **Source of truth:** SaaS Maker owns marketing ideas, approval state, and
  task linkage. Significant Hobbies owns canonical article claims and
  creative approval. This repo owns media production and posting adapters
  only — never the product claims.
- **Engines behind adapters:** do not edit vendored upstream engines under
  `engines/*` unless there is no adapter-only path; prefer sending patches
  upstream. Every engine integration must have a smoke test proving
  request → status → artifact metadata.
- **Secrets:** do not touch platform credentials, API tokens, social accounts,
  `.env` files, or cloud deployment config without explicit approval. Secrets
  resolve from env at runtime only (`*Env`); never embed or log token values.
- **Posting safety:** default to draft/export flows. Autopost requires an
  accepted queue item AND a successful provider response. Manual posting
  records `prepared`, never `posted`. Live CLI actions default to `--dry-run`;
  `--execute` is required to render, upload, or post.
- **Render order:** prefer cheap/local render paths first
  (`mock`/`html-composition`/`ascii`/`grok-video`/`kokoro`), then
  MoneyPrinterTurbo, then premium UGC actors only when quality requires it.
  `render-pro.js` is the canonical production renderer.
- **Anonymous product boundary:** the public brand-reel surface has no auth,
  billing, workspaces, actor onboarding, payouts, or social posting. Do not
  add identity to that path. Real likenesses are fail-closed without
  model-release proof.
- **Kids-story creator MVP:** do not add dashboards, agents, schedulers,
  custom renderers, auto-uploaders, or analytics scripts for kids-story reels
  until the first three manual videos in `docs/product/creator-mvp-packs/`
  exist and pass a parent-trust review.
- **Submodules:** clone with `--recurse-submodules`. Never run
  `git submodule update --remote` on `main` — `openshorts` and `reel-maker`
  float on `heads/main` and would advance without a canary. Use the upgrade
  flow in `docs/development/submodules.md`.

## Documentation navigation

- [`STATUS.md`](STATUS.md) — short executive view (objective, active work,
  blockers, next steps).
- [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — detailed status, dependencies,
  timeline, features shipped, todo/deferred/blocked.
- [`docs/index.md`](docs/index.md) — full docs navigation hub.
- [`docs/product/`](docs/product/) — product surfaces (anonymous brand reel,
  marketing autopilot, creator MVP, content studio, faceless, lessons).
- [`docs/architecture/`](docs/architecture/) — architecture overview, engines,
  render modes, Rust orchestrator, and ADRs.
- [`docs/development/`](docs/development/) — setup, commands, testing,
  submodules, docs build.
- [`docs/operations/`](docs/operations/) — deployment, auto-posting,
  instagram setup, scheduled jobs, runbooks.
- [`docs/knowledge/`](docs/knowledge/) — learnings, OSS evaluation, failed
  approaches, recommendation context.
- [`docs/feature-suggestions/`](docs/feature-suggestions/) — proposed,
  not-yet-built ideas.
- [`docs/archive/`](docs/archive/) — historical PRDs and plans.

## Documentation maintenance rules

1. **Markdown is the source of truth.** Blume (`blume.config.ts`) is only the
   presentation/search layer; never edit generated `.blume/` or `dist/`.
2. **One canonical home per fact.** Do not duplicate facts across README,
   AGENTS, PROJECT_STATUS, and docs/. Link, do not restate.
3. **Code/config is authoritative for implementation details and schedules**
   (`package.json`, `config/*.json`, `wrangler.jsonc`, CI workflows). Do not
   mirror those facts in prose; link to the file.
4. **Document *why*, not *what*.** Capture non-obvious constraints, operational
   procedures, important decisions (ADRs under `docs/architecture/decisions/`),
   and reusable failed approaches (`docs/knowledge/failed-approaches/`).
5. **Do not invent information.** Mark unresolved questions explicitly.
6. **Preserve history.** Use `git mv` when reorganizing docs. Prefer
   `docs/archive/<name>.md` over deletion.
7. **Keep AGENTS.md concise.** Link to deeper docs; do not inline them here.
8. **Validate before committing.** Run `npm run docs:validate`; CI enforces it.
