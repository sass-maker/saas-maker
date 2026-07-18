# agents.md — saas-maker (The Foundry)

## Shared Fleet Standard

Also read and follow the shared fleet-level agent standard at `../AGENTS.md`. Treat this repository as owned product code: protect production stability, keep changes scoped, verify work, and record durable follow-up tasks when something remains incomplete or blocked.

## Purpose
The Foundry platform — CLI, SDKs, widgets, CF Workers API, cockpit dashboard, and docs. API-first SaaS scaffolding with feedback, testimonials, task management, analytics, and more.

## Stack
- Framework: Hono + CF Workers (API at api.sassmaker.com); Next.js (cockpit at app.sassmaker.com); Astro (docs)
- Language: TypeScript
- DB: Cloudflare D1 + Drizzle
- Auth: better-auth (Google OAuth) — cockpit issues opaque session tokens that workers/api validates against the shared D1 `session` table
- Testing: Vitest (unit), Playwright (e2e)
- Deploy: Cloudflare Workers (API `saasmaker-api`, cockpit `saasmaker-dashboard` via @opennextjs/cloudflare, droid runner `saasmaker-droid`); Cloudflare Pages (docs `saas-maker-docs`, landing `saas-maker-home`)
- Package manager: pnpm workspace

## Repo structure
```
workers/api/            # Hono CF Worker — core API
  src/
    index.ts            # Routes
    db/                 # Drizzle schema + client
    routes/             # Route handlers by feature
    middleware/         # Auth + rate-limit
workers/droid/          # Experimental Cloudflare Sandbox runner (Containers + DO)
apps/
  cockpit/              # Next.js cockpit (app.sassmaker.com)
  docs/                 # Legacy Astro/Starlight docs site (docs.sassmaker.com) — presentation only
  docs-blume/           # Blume presentation layer; renders docs/ (content.root → ../../docs)
  showcase/             # Landing page + showcase (sassmaker.com)
packages/
  cli/                  # @saas-maker/cli — validates commands against OpenAPI
    src/openapi.json    # CLI enforcement source (auto-generated — do not edit manually)
    README.md           # CLI docs
  sdk/                  # @saas-maker/sdk — client library
  blocks/               # Headless backend logic
  widgets/              # Embeddable widgets (feedback, changelog, testimonials, waitlist)
internal/contracts/     # API/Cockpit type contracts (@saas-maker/contracts path alias)
tests/
  api/                  # Vitest unit tests (mock DB)
    helpers.ts          # request() helper for Hono app
  cli/                  # CLI unit tests
  integration/          # Integration tests (hit live api.sassmaker.com — NOT in CI)
scripts/
  generate-openapi.mjs  # Regenerates OpenAPI spec across all three artifacts
  check-docs.mjs        # Docs validation (broken links, empty docs, required files)
docs/                   # Canonical knowledge system — Markdown source of truth
  README.md             # Layout + maintenance rules
  getting-started/ api/ sdk/ services/ widgets/   # public product surface (Blume-rendered)
  current/ product/ architecture/ architecture/decisions/ architecture/research/
  development/ operations/ operations/jobs/ operations/runbooks/
  knowledge/ knowledge/learnings/ knowledge/failed-approaches/
  org-profiles/ openapi/  # generated OpenAPI artifact
codex-automations/      # Scheduled cron jobs (automation.toml) — see docs/operations/jobs/
```

## Key commands
```bash
pnpm test                    # Unit tests (Vitest — mock DB, no credentials needed)
pnpm test:integration        # Integration tests (requires SAASMAKER_API_KEY, hits live API)
pnpm typecheck               # TypeScript check across workspace
pnpm lint                    # Lint across workspace
pnpm check:docs              # Validate docs (broken links, empty docs, required files)

# REQUIRED when API routes change — run ALL of these:
node scripts/generate-openapi.mjs   # Regenerate OpenAPI spec (updates 3 files)
# Then update: packages/cli/README.md + docs/sdk/cli.md + examples
```

## Architecture notes
- **API-first philosophy**: `fnd api` is the primary interface for all backend features. Do not add feature-specific CLI commands unless there is clear repeated workflow value.
- **REQUIRED WORKFLOW when API routes change**: (1) run `generate-openapi.mjs` — updates `packages/cli/src/openapi.json`, `docs/openapi/openapi.json`, `apps/docs/public/openapi.json`; (2) update `packages/cli/README.md` and `docs/sdk/cli.md` (canonical); (3) add `fnd examples` entry if user-facing.
- **CLI validates all commands against OpenAPI** by default. Use `--no-validate` only for temporary experimentation.
- **Standards API**: `GET/PUT /v1/standards/:type` — remote config for fleet management.
- **Testing standard**:
  - Unit tests: mock DB via `vi.mock('../../workers/api/src/db')`. Auth bypass: mock `getProjectByApiKey` (API key routes) or `getCliTokenUser` (`sm_` prefix routes). Use `tests/api/helpers.ts` `request()` helper. Run in CI on every push.
  - Integration tests: hit live `api.sassmaker.com`, require `SAASMAKER_API_KEY`, NOT run in CI.
  - Organize as `tests/api/<module>.test.ts`.
- **Documentation standard**: concise, recipe-style, every example copy-paste runnable (or mark placeholders like `<projectId>`).
- **Pre-push gate**: lint, fleet-wide `tsc --noEmit`, vitest run, secret scan. Defined in `.husky/pre-push`.
- **Fleet Cloudflare state**: `cloudflare.targets.json` is the source of truth for Cloudflare target names, required secret names, vars, and bindings. Run `pnpm fleet:secret-audit -- --project <slug> --fail-on-missing` after changing Wrangler config or runtime env requirements. See `docs/operations/cloudflare-secret-management.md`.
- **Post-deploy gate**: `pnpm smoke` (or implicit via `pnpm -F @saas-maker/{api,dashboard} run deploy`) hits prod; failure = bad release. Source: `scripts/smoke-prod.mjs`.
- **Cockpit/API auth bridge**: cockpit signs in via better-auth (`apps/cockpit/src/lib/auth.ts` + `auth-schema.ts`); workers/api `requireSession` resolves opaque Bearer tokens against the shared D1 `session` table (CLI tokens with `sm_` prefix are also accepted). No JWE / Auth.js fallback — better-auth is the single source of truth.
- **Testing backlog**: living list of uncovered surfaces at `docs/development/testing-backlog.md`. Triage rule: only test what burned us before or what's on the daily critical path. Refresh after every regression.
- **Auto-changelog on done**: `pnpm symphony done <id>` automatically creates a draft changelog entry (via `POST /v1/changelog/from-task`) for `feature` and `bug` task types. Infra/chore/docs/research/cleanup tasks are skipped. Duplicate calls are idempotent (no duplicate entries). Drafts are unpublished and visible in Cockpit changelog — publish them when ready. Route handler: `workers/api/src/routes/changelog.ts`.

## Documentation

The canonical knowledge system is the `docs/` tree at the repo root. Markdown
committed there is the source of truth. [`STATUS.md`](STATUS.md) is the short
current-state view; [`PROJECT_STATUS.md`](PROJECT_STATUS.md) is the append-only
timeline (kept at root because `pnpm check:fleet-contracts` verifies its
presence across the fleet). Full layout and maintenance rules live in
[`docs/README.md`](docs/README.md) — read it before adding or moving docs.

Navigation:

- `docs/getting-started/` · `docs/api/` · `docs/sdk/` · `docs/services/` · `docs/widgets/` — public product surface (rendered by Blume at `docs.sassmaker.com`).
- `docs/product/` — what SaaS Maker is, fleet registry, ideas, recommendation context.
- `docs/architecture/` — system shape, Symphony, Droid, task-cloud; `decisions/` (ADR-style dated design records); `research/`.
- `docs/development/` — testing backlog, quality gates, API-route-change workflow.
- `docs/operations/` — Cloudflare secrets, shields, baselines, migrations, PostHog, automation setup, launch kit; `jobs/` (cron catalog); `runbooks/`.
- `docs/knowledge/` — `learnings/` (novel primitives/patterns); `failed-approaches/` (removed/shelved work + why).
- `docs/openapi/` — generated OpenAPI artifact (regenerated by `pnpm generate:openapi`).

Presentation layers (do not author content here):

- `apps/docs-blume/` — Blume; `blume.config.ts` points `content.root` at `../../docs`. `dist/` and `.blume/` are gitignored build artifacts.
- `apps/docs/` — legacy Astro/Starlight site currently serving `docs.sassmaker.com`; holds its own copy of the public product docs until cutover. When the two diverge, `docs/` wins.

Documentation maintenance rules:

1. **One home per fact.** Do not duplicate a concept in two files — link instead.
2. **Markdown is the source of truth.** Never edit content inside `apps/docs-blume/dist/` or `apps/docs/dist/`.
3. **Record why, not what.** Code shows what; document non-obvious constraints, operational procedures, decisions, and reusable failed approaches.
4. **Mark unresolved questions explicitly** (`TBD`, `Open question:`).
5. **When API routes change**, run `pnpm generate:openapi` and update the relevant `docs/services/` or `docs/sdk/` page.
6. **Validate before pushing**: `pnpm check:docs` checks broken links, empty docs, and required files. It runs in CI.
7. **Keep pages focused** (150–300 lines). Split catch-all docs into per-topic pages.

<!-- FLEET-GUIDANCE:START -->

## Fleet Guidance

### Adding Tasks
- Add durable work items in SaaS Maker Cockpit Tasks when the task affects product behavior, deployment, user feedback, or fleet maintenance.
- Include the project slug, a concise title, acceptance criteria, priority/status, and links to relevant code, issues, traces, or dashboards.
- If task discovery starts locally in an editor or agent session, mirror the durable next step back into SaaS Maker before handoff.

### Using SaaS Maker
- Treat SaaS Maker as the system of record for project metadata, feedback, tasks, analytics, testimonials, changelog, and fleet visibility.
- Treat the Cockpit Progress Board as the source of truth for public product progress; keep it separate from Cockpit Tasks.
- Agents must confirm intended public progress changes with the user before creating, editing, or deleting Progress Board items.
- Prefer API-first workflows through `fnd api`, the SDK, or widgets instead of one-off scripts when interacting with SaaS Maker features.
- Keep this agent file aligned with the project record when operating rules, integrations, or deployment conventions change.

### Fleet UI Standard
- All fleet projects with a visual interface should move toward a free, beautiful, shadcn-compatible local UI standard when UI work is in scope.
- Prefer Tailwind tokens, local reusable components, lucide-react icons, and accessible Radix UI or React Aria primitives where they fit the repo's existing stack.
- Use free/open component sources only. Aceternity UI free components are preferred for polished sections, cards, backgrounds, empty states, timelines, Bento grids, and high-visibility surfaces when they fit the product. shadcn/ui remains the base reference for durable app controls, with Magic UI and Origin UI as complementary free sources.
- Do not preserve ugly UI by default. Migrate touched surfaces screen-by-screen with small diffs instead of forcing one global package or whole-stack rewrite.
- Operational/admin surfaces should stay dense, scannable, accessible, and fast. Marketing, demo, onboarding, and showcase surfaces can be more expressive, but motion and decorative effects must remain purposeful.
- Do not add paid assets or broad UI dependencies without explicit approval. Explain any new UI dependency with why this, why now, and why existing code is insufficient.
- Verify meaningful visual changes with a browser check or screenshot across relevant desktop/mobile states.

### Free AI First
- Prefer free/local AI paths for routine development and analysis: the `free-ai` gateway, local models, provider free tiers, and cached context.
- Escalate to paid models only when complexity, correctness risk, or missing capability justifies the cost.
- Note any paid-AI use in the task or handoff when it materially affects cost, reproducibility, or future maintenance.

<!-- FLEET-GUIDANCE:END -->
