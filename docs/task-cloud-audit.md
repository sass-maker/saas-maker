# Task Cloud Audit (Foundry / Fleet)

Goal: list recurring task types we run from this repo and the preferred execution “cloud” (where it should run) plus when it needs outside intervention.

Legend:
- **Local (Mac/Codex)**: run on your machine (fast iteration, full repo access).
- **GitHub Actions**: CI/cron workflows (repeatable, no local state).
- **Cloudflare Workers**: production/runtime checks that must run “near” Workers, or as a Workers-hosted automation lane.
- **Vercel**: cockpit deploy/build surfaces (when the task is inherently Vercel-hosted).

## Recommended mapping

| Task type | What it does | Preferred “cloud” | Notes / outside intervention |
|---|---|---|---|
| Fleet audit (local checks) | `pnpm run typecheck/test/build` across fleet repos | **Local (Mac/Codex)** | Needs write access to fleet repos for build artifacts (`.next`, `tsconfig.tsbuildinfo`, etc.). |
| Fleet audit (prod smoke) | HTTP smoke checks for known prod URLs | **GitHub Actions** (or Local) | Best as a scheduled workflow so it’s not blocked by local network/DNS state. |
| Fleet audit (performance curl timings) | lightweight timing/size checks | **GitHub Actions** | Deterministic environment helps; keep concurrency controlled. |
| Fleet audit (Lighthouse) | Lighthouse perf/a11y/bp/seo collection | **GitHub Actions** | Requires Chrome; can be slow/flaky. Prefer `--only-categories` + budgets; store artifacts. |
| Fleet failure importer | Convert failing GitHub workflows → Symphony tasks | **GitHub Actions** | Needs `gh` auth; best as nightly job; write-back to tasks requires Foundry auth. |
| Symphony task sync | `pnpm symphony` read/write `/v1/tasks` | **Local (Mac/Codex)** | Needs `fnd login` session; write operations are user-affecting. |
| Symphony dispatch (agent runs) | run agent command templates on a task | **Local (Mac/Codex)** | Default today; safe when full local perms are intended. |
| Symphony cloud runner (future) | run constrained tasks remotely | **Cloudflare Workers** | Requires the Dynamic Workers lane (design + auth + logging). |
| OpenAPI regeneration | `node scripts/generate-openapi.mjs` | **Local (Mac/Codex)** (or GitHub Actions PR check) | Writes generated artifacts; should be run as part of PRs that change API routes. |
| Docs build verification | build `apps/docs` (Astro) | **GitHub Actions** | Best as CI check on PRs; static output can be previewed. |
| Cockpit build verification | build `apps/cockpit` (Next) | **GitHub Actions** | CI parity with Vercel build environment is ideal. |
| Cockpit deploy | deploy to Vercel | **Vercel** | Outside intervention if deployment is blocked by Vercel/project settings. |
| API deploy | deploy Workers | **Cloudflare Workers** | Outside intervention if secrets/bindings/CF account access needed. |
| Prod smoke post-deploy gate | run `pnpm smoke` (prod) | **GitHub Actions** | Should run after deploy in pipeline; failing should block release. |
| Standards checks | validate `/v1/standards/:type` constraints | **Cloudflare Workers** (runtime) + GitHub Actions (lint) | Runtime validation belongs in API; scheduled conformance in CI. |
| Secret scanning / dependency audit | detect leaked creds / vuln deps | **GitHub Actions** | Must not run locally with elevated access unless intended. |

## Practical “can we auto-fix?” guidance

- **Safe to auto-fix locally:** permission-related local-check failures where we can apply `chmod u+rwX` and retry (no content changes).
- **Not safe to auto-fix automatically:** dirty worktrees, dependency upgrades, deploys, migrations, or anything that publishes externally.
- **Needs outside intervention:** missing auth (`fnd login`, `gh auth`), missing cloud credentials, locked-down sandbox/write paths, Vercel/Cloudflare account/config access.

