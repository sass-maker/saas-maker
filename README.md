# SaaS Maker

**Product:** [sassmaker.com](https://sassmaker.com)


SaaS Maker is a TypeScript monorepo for building and operating small SaaS products across a project fleet. It includes a Cloudflare Workers API, a Next.js cockpit, embeddable widgets, shared backend blocks, documentation, and an experimental autonomous runner called Droid.

The repo is public, but parts of the deployment are still personal/internal. Treat this as an active product workspace rather than a polished framework release.

## Deployment & External Services

Everything is hosted on Cloudflare. Each deployable ships independently through
the guarded GitHub Actions workflows (`.github/workflows/ci.yml`) after an
explicit production deploy decision; `main` stays releasable but is not itself
an automatic production trigger.

| Deployable        | Source          | Host                                                                                             |
| ----------------- | --------------- | ------------------------------------------------------------------------------------------------ |
| API               | `workers/api`   | Cloudflare Worker `saasmaker-api` (Hono; route `api.sassmaker.com`)                              |
| Cockpit dashboard | `apps/cockpit`  | Cloudflare Worker `saasmaker-dashboard` via `@opennextjs/cloudflare` (route `app.sassmaker.com`) |
| Droid runner      | `workers/droid` | Cloudflare Worker `saasmaker-droid` (Containers + Durable Objects)                               |
| Docs              | `apps/docs-blume` + `docs/` | Blume folded into Cloudflare Pages `saas-maker-home` at `sassmaker.com/docs`       |
| Landing/home      | `apps/showcase` | Cloudflare Pages `saas-maker-home` (Astro static; `sassmaker.com`)                               |

| Concern      | Service                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| Hosting      | Cloudflare Workers + Cloudflare Pages (see table above)                                                              |
| Database     | Cloudflare D1 (`saasmaker-db`) — shared by API, cockpit, and Droid; Drizzle ORM                                      |
| Auth         | better-auth + Google OAuth (cockpit); API validates better-auth session tokens against the shared D1 `session` table |
| File storage | Cloudflare R2 (`saasmaker-feedback-images`)                                                                          |
| AI           | Cloudflare Workers AI binding; optional free-ai proxy (`FREE_AI_BASE_URL`); Droid uses DeepSeek models               |
| Email        | None in production routes today (Cloudflare Email Workers migration planned; legacy Resend helper remains in `workers/api/src/email.ts`) |
| Analytics    | PostHog                                                                                                              |
| CI/CD        | GitHub Actions — build/test on every push/PR, auto-deploy each app to Cloudflare on push to `main`                   |


## What Is Inside

- `workers/api` - Hono API on Cloudflare Workers with D1 and Drizzle.
- `workers/droid` - Experimental Cloudflare Sandbox runner for task execution and PR creation.
- `apps/cockpit` - Next.js dashboard for projects, tasks, fleet state, and Droid runs.
- `apps/docs-blume` - Blume presentation layer for the canonical root `docs/` tree; served at `sassmaker.com/docs`.
- `apps/showcase` - Foundry landing page (Astro, pure static; serves `sassmaker.com`).
- `packages/cli` - `fnd` CLI backed by the generated OpenAPI spec.
- `internal/contracts/` - Internal API/Cockpit type contracts (`@saas-maker/contracts` path alias).
- `packages/blocks` - `@saas-maker/sdk` client library.
- `packages/widgets` - Embeddable feedback, changelog, testimonials, and waitlist widgets.

## Current Status

- API, cockpit, docs, widgets, and CLI are actively developed.
- Droid v1 can run sandboxed tasks and create draft PRs, but it is still experimental.
- Public docs are authored in the root `docs/` tree and served through Blume at `sassmaker.com/docs`.

## Fleet Registry

`foundry.projects.json` is the source of truth for the active fleet catalog. The public showcase at `sassmaker.com` derives its project list from that registry at build time. `tier` separates focus, support/platform, and personal projects; `priority` tracks current attention level (`P1`, `P2`, `P3`).

| Project                                                                     | Category | Priority | Role                                                              |
| --------------------------------------------------------------------------- | -------- | -------- | ----------------------------------------------------------------- |
| [`CodeVetter`](https://github.com/Codevetter/codevetter)                         | product  | P1       | Desktop-first AI code review platform.                            |
| [`pace`](https://github.com/HeyPace/pace)                                        | product  | P1       | Local macOS voice agent.                                          |
| [`posttrainllm`](https://github.com/PostTrainLLM/posttrainllm)                   | product  | P1       | Post-training and model learning workspace.                       |
| [`saas-maker`](https://github.com/sass-maker/saas-maker)                        | product  | P1       | Core product platform, cockpit, API, docs, widgets, and tooling.  |
| [`high-signal`](https://github.com/High-Signal-App/high-signal)                  | product  | P1       | Core signal product for AI infrastructure and semiconductors.     |
| [`drank`](https://github.com/High-Signal-App/drank)                              | product  | P2       | Domain Rating tracker for domain research.                        |
| [`free-ai`](https://github.com/sass-maker/free-ai)                               | product  | P2       | OpenAI-compatible LLM gateway for free-tier providers.            |
| [`knowledge-base`](https://github.com/sass-maker/knowledge-base)                  | product  | P2       | Private Agent Search over project-scoped corpora.                 |
| [`reel-pipeline`](https://github.com/sass-maker/reel-pipeline)                    | product  | P2       | Short-form video generation pipeline for fleet marketing assets.  |
| [`research-papers`](https://github.com/High-Signal-App/research-papers)           | product  | P2       | Academic paper platform and research data asset.                  |
| [`starboard`](https://github.com/Codevetter/starboard)                            | product  | P2       | GitHub stars organizer and semantic search under CodeVetter.      |
| [`everythingrated`](https://github.com/High-Signal-App/everythingrated)           | product  | P2       | Multi-axis AI dev-tool adoption ratings.                          |
| [`psi-swarm`](https://github.com/sass-maker/psi-swarm)                            | helper   | P2       | Repeated Lighthouse performance tracking and comparison.         |
| [`anime-list`](https://github.com/Significant-Hobbies/anime-list)                 | personal | P3       | Personal anime discovery and tracking surface.                    |
| [`aliveville`](https://github.com/sarthakagrawal927/aliveville)                  | personal | P3       | Maintained multi-agent world experiment; not a focus product.     |
| [`chess`](https://github.com/Significant-Hobbies/chess)                           | personal | P3       | Stockfish chess with optional AI coaching.                        |
| [`email-manager`](https://github.com/sarthakagrawal927/email-manager)             | personal | P3       | Personal email operations workspace.                              |
| [`karte`](https://github.com/sarthakagrawal927/karte)                             | personal | P3       | AI link-in-bio product.                                           |
| [`looptv`](https://github.com/Significant-Hobbies/looptv)                         | personal | P3       | Personal ambient video and anime list companion.                  |
| [`materia`](https://github.com/Significant-Hobbies/materia)                       | personal | P3       | Interactive anatomy and evidence-graded remedies.                 |
| [`protein-index`](https://github.com/Significant-Hobbies/protein-index)           | personal | P3       | Source-aware protein product intelligence.                        |
| [`reader`](https://github.com/Significant-Hobbies/reader)                         | personal | P3       | Personal reading and saved-article workflow.                      |
| [`rolepatch`](https://github.com/sarthakagrawal927/rolepatch)                     | personal | P3       | RolePatch resume tailoring product.                               |
| [`significanthobbies`](https://github.com/Significant-Hobbies/significanthobbies) | personal | P3       | Personal hobby mapping and journey visualization tool.            |
| [`swe-interview-prep`](https://github.com/Significant-Hobbies/swe-interview-prep) | personal | P3       | Personal interview practice workspace.                            |
| [`truehire`](https://github.com/sarthakagrawal927/truehire)                       | personal | P3       | RolePatch-family hiring workspace.                                |

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
pnpm check:fleet-contracts
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

See [docs/architecture/droid.md](docs/architecture/droid.md) for the quickstart and API fields, and [docs/architecture/droid-roadmap.md](docs/architecture/droid-roadmap.md) for what is next before Droid should be treated as a hands-off production employee.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). For security issues, use [SECURITY.md](SECURITY.md) instead of opening a public issue.

## License

MIT. See [LICENSE](LICENSE).

<!-- ACTIVE-AI-TASK-LOG:START -->

## Active AI Task Log

This section is maintained by the SaaS Maker Active-AI product/design loop so future agents do not reopen duplicate UI tasks.

- Fleet bucket: Core product
- Rule: do not create another broad "improve the UI" task unless the acceptance criteria differ materially from the tasks listed here.
- Source of truth for task status: SaaS Maker task board. README entries are durable context only.

| Task                                                                       | Status | Priority | Last known note     |
| -------------------------------------------------------------------------- | ------ | -------- | ------------------- |
| `564d7c2a` [fleet-audit] saas-maker Fleet Production Smoke failing         | done   | high     | 2026-05-25 18:55:41 |
| `01d844e7` [needs-user] Expose PostHog connector for fleet analytics audit | todo   | medium   | 2026-05-25 17:03:12 |

<!-- ACTIVE-AI-TASK-LOG:END -->
