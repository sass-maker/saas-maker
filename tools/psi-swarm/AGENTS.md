# AGENTS.md — psi-swarm

> Agent bootloader. Concise by design — depth lives in [`docs/`](./docs/).
> Also follow the shared fleet standard at `../../AGENTS.md` (fleet root).

## What this is

psi-swarm is a **local-first** website performance tracker. It runs
Lighthouse 12 many times across realistic device/network presets and
reports the **p50 / p75 / p90 / p99** of Web Vitals instead of one noisy
point. Compute stays on the user's machine; the browser UI is only a
controller. MIT, no telemetry, no account.

It lives under `fleet-ops/` (part of the fleet-ops project, not a standalone
fleet product). The installable agent skill is `SKILL.md` (symlinked from
`~/.claude/skills/psi-swarm/SKILL.md`) — **do not edit it from this repo's
docs work; it is a tooling definition owned by the fleet-ops skill layer.**

## Essential commands

```bash
pnpm run setup                                      # install + build CLI
pnpm run cli -- run <url> --runs 5 --parallel auto  # a swarm
pnpm run serve                                      # local HTTP agent (for web UI)
pnpm run web                                        # Astro dev server → :4321
pnpm run build:cli && pnpm run build:web            # type-check by build
pnpm docs:check                                     # validate docs/ + internal links
pnpm docs:dev                                       # Blume docs dev server
```

**Node 22 LTS** required (Lighthouse 12 breaks on Node 24). pnpm 10.33.2
pinned via `packageManager`.

## Critical constraints

- **No root test/lint scripts.** CLI and web have their own; today neither
  has a test suite (see [docs/development/testing.md](./docs/development/testing.md)).
- **No automated CI on push.** Only `.github/workflows/deploy.yml`
  (manual dispatch) and `.github/workflows/docs.yml` (docs paths) exist.
  `scripts/manual-deploy.mjs` has a dead `ci.yml` default that is never
  used — `pnpm deploy` passes `deploy.yml` as the green-gate. See
  [docs/operations/deploy.md](./docs/operations/deploy.md).
- **Deploy is manual.** `main` should stay releasable/green but is not an
  automatic production trigger. Use `pnpm deploy` (guarded) — see
  [docs/operations/deploy.md](./docs/operations/deploy.md).
- **Local-first.** The deployed site is a static Astro build — no SSR, no
  Workers, no runtime secrets. Don't add server-side compute.
- **Don't touch** `SKILL.md`, `.claude/`, or any skill/plugin definitions.
- **Don't** deploy, migrate, rotate credentials, or edit production config
  unless explicitly asked.

## Documentation navigation

The canonical knowledge system is [`docs/`](./docs/). Start at
[`docs/index.md`](./docs/index.md).

- [Product](./docs/product/) — overview, surfaces (CLI/web/API/skill), presets
- [Architecture](./docs/architecture/) — system design, data model, ADRs
- [Development](./docs/development/) — workflow, reasoning backends, testing
- [Operations](./docs/operations/) — deploy, background jobs, runbooks
- [Knowledge](./docs/knowledge/) — learnings, failed approaches
- [Current](./docs/current/) — proposed/in-progress specs
- [PRDs](./docs/prds/) — shipped v0.4.0 PRDs

Two status homes, by design — don't duplicate:

- [`STATUS.md`](./STATUS.md) — short living snapshot (today's objective,
  active work, blockers, unresolved questions, next steps).
- [`PROJECT_STATUS.md`](./PROJECT_STATUS.md) — fleet-mandated durable
  ledger (why/what, dependencies, full timeline, shipped features,
  long-form todo/deferred/blocked). **Canonical history.**

## Documentation maintenance rules

1. **Markdown in `docs/` is the source of truth.** Blume
   (`blume.config.ts`) is only the presentation/search layer — never edit
   generated files in `docs-dist/`.
2. **One home per fact.** If a fact lives in `PROJECT_STATUS.md` or in
   code, link to it; don't restate.
3. **Code is authoritative** for implementation details and schedules.
4. **Mark unresolved questions** explicitly (`_Unresolved:_`).
5. **No empty folders or placeholder pages.**
6. **Run `pnpm docs:check` before merging docs changes.** CI
   (`.github/workflows/docs.yml`) runs the same check on PRs touching
   `docs/`.
7. When a `docs/current/` spec ships, move it to `docs/prds/` with a
   `Status: Shipped` header and update `PROJECT_STATUS.md`.
