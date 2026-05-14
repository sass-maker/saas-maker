# Contributing

Thanks for taking a look at SaaS Maker. This repo is public, but it is still an active product workspace, so small focused changes are easiest to review.

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
```

Prefer the smallest relevant check before broader test runs. If you change API routes, also run:

```bash
pnpm generate:openapi
pnpm check:openapi
```

## Pull Requests

- Keep diffs focused.
- Include tests or a clear reason they are not needed.
- Update docs when behavior changes.
- Do not commit secrets, local environment files, generated credentials, or production config.
- Do not deploy from a PR unless the maintainer explicitly asks for it.

## Project Notes

Agent-facing repo rules live in [AGENTS.md](AGENTS.md). They are part of the working contract for humans and AI agents in this repo.
