# SaaS Maker

SaaS Maker is a TypeScript monorepo for building and operating small SaaS products across a project fleet. It includes a Cloudflare Workers API, a Next.js cockpit, embeddable widgets, shared backend blocks, documentation, and an experimental autonomous runner called Droid.

The repo is public, but parts of the deployment are still personal/internal. Treat this as an active product workspace rather than a polished framework release.

## What Is Inside

- `workers/api` - Hono API on Cloudflare Workers with D1 and Drizzle.
- `workers/droid` - Experimental Cloudflare Sandbox runner for task execution and PR creation.
- `apps/cockpit` - Next.js dashboard for projects, tasks, fleet state, and Droid runs.
- `apps/docs` - Astro/Starlight docs site.
- `apps/showcase` - Widget and product showcase.
- `packages/cli` - `fnd` CLI backed by the generated OpenAPI spec.
- `packages/blocks` - Shared backend and operational packages.
- `packages/widgets` - Embeddable feedback, changelog, progress, testimonials, waitlist, and badge widgets.
- `packages/tooling` - Shared TypeScript, ESLint, Prettier, test, Renovate, and Tailwind config.

## Current Status

- API, cockpit, docs, widgets, and CLI are actively developed.
- Droid v1 can run sandboxed tasks and create draft PRs, but it is still experimental.
- Public docs are being cleaned up as the repository becomes more open-source friendly.

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

See [docs/droid-roadmap.md](docs/droid-roadmap.md) for what is next before Droid should be treated as a hands-off production employee.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). For security issues, use [SECURITY.md](SECURITY.md) instead of opening a public issue.

## License

MIT. See [LICENSE](LICENSE).
