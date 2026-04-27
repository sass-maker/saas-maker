# agents.md — saas-maker (The Foundry)

## Purpose
The Foundry platform — CLI, SDKs, widgets, CF Workers API, cockpit dashboard, and docs. API-first SaaS scaffolding with feedback, testimonials, task management, analytics, and more.

## Stack
- Framework: Hono + CF Workers (API at api.sassmaker.com); Next.js (cockpit at app.sassmaker.com); Astro (docs)
- Language: TypeScript
- DB: Cloudflare D1 + Drizzle
- Auth: better-auth (Google OAuth) — cockpit issues opaque session tokens that workers/api validates against the shared D1 `session` table
- Testing: Vitest (unit), Playwright (e2e)
- Deploy: Cloudflare Workers (API), Vercel (cockpit)
- Package manager: pnpm workspace

## Repo structure
```
workers/api/            # Hono CF Worker — core API
  src/
    index.ts            # Routes
    db/                 # Drizzle schema + client
    routes/             # Route handlers by feature
    middleware/         # Auth + rate-limit
apps/
  cockpit/              # Next.js cockpit (app.sassmaker.com)
  docs/                 # Astro docs site
  showcase/             # Landing page + showcase
packages/
  cli/                  # @saas-maker/cli — validates commands against OpenAPI
    src/openapi.json    # CLI enforcement source (auto-generated — do not edit manually)
    README.md           # CLI docs
  sdk/                  # @saas-maker/sdk — client library
  blocks/               # Headless backend logic (ops, db, etc.)
  widgets/              # Embeddable widgets (badge, feedback, etc.)
  tooling/              # Shared configurations (eslint, tsconfig)
tests/
  api/                  # Vitest unit tests (mock DB)
    helpers.ts          # request() helper for Hono app
  cli/                  # CLI unit tests
  integration/          # Integration tests (hit live api.sassmaker.com — NOT in CI)
scripts/
  generate-openapi.mjs  # Regenerates OpenAPI spec across all three artifacts
docs/
  openapi/openapi.json  # Documentation artifact
```

## Key commands
```bash
pnpm test                    # Unit tests (Vitest — mock DB, no credentials needed)
pnpm test:integration        # Integration tests (requires SAASMAKER_API_KEY, hits live API)
pnpm typecheck               # TypeScript check across workspace
pnpm lint                    # Lint across workspace

# REQUIRED when API routes change — run ALL of these:
node scripts/generate-openapi.mjs   # Regenerate OpenAPI spec (updates 3 files)
# Then update: packages/cli/README.md + apps/docs/src/content/docs/sdk/cli.md + examples
```

## Architecture notes
- **API-first philosophy**: `fnd api` is the primary interface for all backend features. Do not add feature-specific CLI commands unless there is clear repeated workflow value.
- **REQUIRED WORKFLOW when API routes change**: (1) run `generate-openapi.mjs` — updates `packages/cli/src/openapi.json`, `docs/openapi/openapi.json`, `apps/docs/public/openapi.json`; (2) update `packages/cli/README.md` and `apps/docs/src/content/docs/sdk/cli.md`; (3) add `fnd examples` entry if user-facing.
- **CLI validates all commands against OpenAPI** by default. Use `--no-validate` only for temporary experimentation.
- **Standards API**: `GET/PUT /v1/standards/:type` — remote config for fleet management.
- **Testing standard**:
  - Unit tests: mock DB via `vi.mock('../../workers/api/src/db')`. Auth bypass: mock `getProjectByApiKey` (API key routes) or `getCliTokenUser` (`sm_` prefix routes). Use `tests/api/helpers.ts` `request()` helper. Run in CI on every push.
  - Integration tests: hit live `api.sassmaker.com`, require `SAASMAKER_API_KEY`, NOT run in CI.
  - Organize as `tests/api/<module>.test.ts`.
- **Documentation standard**: concise, recipe-style, every example copy-paste runnable (or mark placeholders like `<projectId>`).
- **Pre-push gate**: lint, fleet-wide `tsc --noEmit`, vitest run, secret scan. Defined in `.husky/pre-push`.
- **Post-deploy gate**: `pnpm smoke` (or implicit via `pnpm -F @saas-maker/{api,dashboard} run deploy`) hits prod; failure = bad release. Source: `scripts/smoke-prod.mjs`.
- **Cockpit/API auth bridge**: cockpit signs in via better-auth (`apps/cockpit/src/lib/auth.ts` + `auth-schema.ts`); workers/api `requireSession` resolves opaque Bearer tokens against the shared D1 `session` table (CLI tokens with `sm_` prefix are also accepted). No JWE / Auth.js fallback — better-auth is the single source of truth.
- **Testing backlog**: living list of uncovered surfaces at `docs/testing-backlog.md`. Triage rule: only test what burned us before or what's on the daily critical path. Refresh after every regression.

## Active context
