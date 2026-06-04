# SaaS Maker

SaaS Maker is a TypeScript monorepo for building and operating small SaaS products across a project fleet. It includes a Cloudflare Workers API, a Next.js cockpit, embeddable widgets, shared backend blocks, documentation, and an experimental autonomous runner called Droid.

The repo is public, but parts of the deployment are still personal/internal. Treat this as an active product workspace rather than a polished framework release.

## Deployment & External Services

Everything is hosted on Cloudflare. Each deployable ships independently via GitHub Actions (`.github/workflows/ci.yml`) on push to `main`, gated by changed paths.

| Deployable        | Source          | Host                                                                                             |
| ----------------- | --------------- | ------------------------------------------------------------------------------------------------ |
| API               | `workers/api`   | Cloudflare Worker `saasmaker-api` (Hono; route `api.sassmaker.com`)                              |
| Cockpit dashboard | `apps/cockpit`  | Cloudflare Worker `saasmaker-dashboard` via `@opennextjs/cloudflare` (route `app.sassmaker.com`) |
| Droid runner      | `workers/droid` | Cloudflare Worker `saasmaker-droid` (Containers + Durable Objects)                               |
| Docs              | `apps/docs`     | Cloudflare Pages `saas-maker-docs` (Astro/Starlight; `docs.sassmaker.com`)                       |
| Landing/home      | `apps/showcase` | Cloudflare Pages `saas-maker-home` (Astro static; `sassmaker.com`)                               |

| Concern      | Service                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| Hosting      | Cloudflare Workers + Cloudflare Pages (see table above)                                                              |
| Database     | Cloudflare D1 (`saasmaker-db`) — shared by API, cockpit, and Droid; Drizzle ORM                                      |
| Auth         | better-auth + Google OAuth (cockpit); API validates better-auth session tokens against the shared D1 `session` table |
| File storage | Cloudflare R2 (`saasmaker-feedback-images`)                                                                          |
| AI           | Cloudflare Workers AI binding; optional free-ai proxy (`FREE_AI_BASE_URL`); Droid uses DeepSeek models               |
| Email        | Resend                                                                                                               |
| Analytics    | PostHog                                                                                                              |
| CI/CD        | GitHub Actions — build/test on every push/PR, auto-deploy each app to Cloudflare on push to `main`                   |

Note: `apps/docs/vercel.json` is stale — docs deploy to Cloudflare Pages, not Vercel. It is a cleanup candidate.

## What Is Inside

- `workers/api` - Hono API on Cloudflare Workers with D1 and Drizzle.
- `workers/droid` - Experimental Cloudflare Sandbox runner for task execution and PR creation.
- `apps/cockpit` - Next.js dashboard for projects, tasks, fleet state, and Droid runs.
- `apps/docs` - Astro/Starlight docs site.
- `apps/showcase` - Foundry landing page (Astro, pure static; serves `sassmaker.com`).
- `packages/cli` - `fnd` CLI backed by the generated OpenAPI spec.
- `packages/blocks` - Shared backend and operational packages.
- `packages/widgets` - Embeddable feedback, changelog, testimonials, and waitlist widgets.
- `packages/tooling` - Shared TypeScript, ESLint, Prettier, test, Renovate, and Tailwind config.

## Current Status

- API, cockpit, docs, widgets, and CLI are actively developed.
- Droid v1 can run sandboxed tasks and create draft PRs, but it is still experimental.
- Public docs are being cleaned up as the repository becomes more open-source friendly.

## Fleet Registry

`foundry.projects.json` is the source of truth for the active fleet catalog. The public showcase at `sassmaker.com` derives its project list from that registry at build time. `category` separates user-facing products from helper systems; `priority` tracks current attention level (`P0`, `P1`, `P2`).

| Project                                                                     | Category | Priority | Role                                                              |
| --------------------------------------------------------------------------- | -------- | -------- | ----------------------------------------------------------------- |
| [`saas-maker`](https://github.com/sarthak-fleet/saas-maker)                 | helper   | P0       | Foundry control plane, cockpit, API, docs, widgets, and showcase. |
| [`CodeVetter`](https://github.com/sarthak-fleet/CodeVetter)                 | product  | P1       | Desktop-first AI code review platform.                            |
| [`ai-game`](https://github.com/sarthak-fleet/ai-game)                       | product  | P1       | Persistent AI world simulator and Aliveville game surface.        |
| [`free-ai`](https://github.com/sarthak-fleet/free-ai)                       | helper   | P1       | OpenAI-compatible gateway for free and local LLM providers.       |
| [`high-signal`](https://github.com/sarthak-fleet/high-signal)               | product  | P1       | Public signal log for AI infrastructure and semiconductors.       |
| [`open-historia`](https://github.com/sarthak-fleet/open-historia)           | product  | P1       | Interactive historical timeline and storytelling product.         |
| [`reel-pipeline`](https://github.com/sarthak-fleet/reel-pipeline)           | helper   | P1       | Fleet marketing video artifact and autopost pipeline.             |
| [`resume-tailor`](https://github.com/sarthak-fleet/resume-tailor)           | product  | P1       | RolePatch resume tailoring product.                               |
| [`truehire`](https://github.com/sarthak-fleet/truehire)                     | product  | P1       | Recruiting and candidate vetting product.                         |
| [`anime_list`](https://github.com/sarthak-fleet/anime_list)                 | product  | P2       | MAL Explorer anime and manga list surface.                        |
| [`email-manager`](https://github.com/sarthak-fleet/email-manager)           | product  | P2       | Unified email management and automation tool.                     |
| [`event-forecast`](https://github.com/sarthak-fleet/event-forecast)         | product  | P2       | Event-stream forecasting and action-report service.               |
| [`everythingrated`](https://github.com/sarthak-fleet/everythingrated)       | product  | P2       | Anonymous multi-axis ratings product.                             |
| [`linkchat`](https://github.com/sarthak-fleet/linkchat)                     | product  | P2       | Real-time chat application.                                       |
| [`local-ai`](https://github.com/sarthak-fleet/local-ai)                     | helper   | P2       | Local bridge for authenticated AI CLIs and development agents.    |
| [`looptv`](https://github.com/sarthak-fleet/looptv)                         | product  | P2       | TV-like curated channel viewing app.                              |
| [`psi-swarm`](https://github.com/sarthak-fleet/psi-swarm)                   | helper   | P2       | Local Lighthouse swarm runner for Web Vitals distributions.       |
| [`reader`](https://github.com/sarthak-fleet/reader)                         | product  | P2       | Web annotator and reading surface.                                |
| [`significanthobbies`](https://github.com/sarthak-fleet/significanthobbies) | product  | P2       | Personal hobby mapping and journey visualization tool.            |
| [`starboard`](https://github.com/sarthak-fleet/starboard)                   | product  | P2       | Project dashboard and management system.                          |
| [`swe-interview-prep`](https://github.com/sarthak-fleet/swe-interview-prep) | product  | P2       | Interview Coder software engineering interview prep.              |
| [`tinygpt`](https://github.com/sarthak-fleet/tinygpt)                       | product  | P2       | Browser/research tiny language model project.                     |
| [`today-little-log`](https://github.com/sarthak-fleet/today-little-log)     | product  | P2       | Daily logging and micro-journaling app.                           |

## Quick Start

```bash
pnpm install
pnpm test
pnpm typecheck
```

Run the main apps locally:

```bash
pnpm dev:api
pnpm dev:cockpit
pnpm dev:cockpit:local
```

`pnpm dev:cockpit:local` is prod-first for the operator task board: it points local Cockpit at `https://api.sassmaker.com` by default so local and production see the same SaaS Maker task data. To intentionally test against a local Worker/D1 database, run with `NEXT_PUBLIC_API_URL=http://localhost:8787`.

Useful checks:

```bash
pnpm lint
pnpm smoke
pnpm check:openapi
```

Some commands require Cloudflare, GitHub, or SaaS Maker production credentials. Do not commit secrets or local environment files.

## API And CLI

SaaS Maker is API-first. When API routes change, regenerate and check the OpenAPI artifacts:

```bash
pnpm generate:openapi
pnpm check:openapi
```

The CLI validates commands against the generated OpenAPI spec. Prefer `fnd api` and generated SDK flows over one-off scripts for product features.

## Droid

Droid is the autonomous task runner for SaaS Maker. It starts a Cloudflare Sandbox, hydrates a repo, runs a command or agent, captures logs and patches, and can raise a draft PR.

See [docs/droid.md](docs/droid.md) for the quickstart and API fields, and [docs/droid-roadmap.md](docs/droid-roadmap.md) for what is next before Droid should be treated as a hands-off production employee.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). For security issues, use [SECURITY.md](SECURITY.md) instead of opening a public issue.

## License

MIT. See [LICENSE](LICENSE).

<!-- ACTIVE-AI-TASK-LOG:START -->

## Active AI Task Log

This section is maintained by the SaaS Maker Active-AI product/design loop so future agents do not reopen duplicate UI tasks.

- Business lane: Core/status context
- Rule: do not create another broad "improve the UI" task unless the acceptance criteria differ materially from the tasks listed here.
- Source of truth for task status: SaaS Maker task board. README entries are durable context only.

| Task                                                                       | Status | Priority | Last known note     |
| -------------------------------------------------------------------------- | ------ | -------- | ------------------- |
| `564d7c2a` [fleet-audit] saas-maker Fleet Production Smoke failing         | done   | high     | 2026-05-25 18:55:41 |
| `01d844e7` [needs-user] Expose PostHog connector for fleet analytics audit | todo   | medium   | 2026-05-25 17:03:12 |

<!-- ACTIVE-AI-TASK-LOG:END -->
