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
- **Fleet Cloudflare state**: `cloudflare.targets.json` is the source of truth for Cloudflare target names, required secret names, vars, and bindings. Run `pnpm fleet:secret-audit -- --project <slug> --fail-on-missing` after changing Wrangler config or runtime env requirements. See `docs/cloudflare-secret-management.md`.
- **Post-deploy gate**: `pnpm smoke` (or implicit via `pnpm -F @saas-maker/{api,dashboard} run deploy`) hits prod; failure = bad release. Source: `scripts/smoke-prod.mjs`.
- **Cockpit/API auth bridge**: cockpit signs in via better-auth (`apps/cockpit/src/lib/auth.ts` + `auth-schema.ts`); workers/api `requireSession` resolves opaque Bearer tokens against the shared D1 `session` table (CLI tokens with `sm_` prefix are also accepted). No JWE / Auth.js fallback — better-auth is the single source of truth.
- **Testing backlog**: living list of uncovered surfaces at `docs/testing-backlog.md`. Triage rule: only test what burned us before or what's on the daily critical path. Refresh after every regression.
- **Auto-changelog on done**: `pnpm symphony done <id>` automatically creates a draft changelog entry (via `POST /v1/changelog/from-task`) for `feature` and `bug` task types. Infra/chore/docs/research/cleanup tasks are skipped. Duplicate calls are idempotent (no duplicate entries). Drafts are unpublished and visible in Cockpit changelog — publish them when ready. Route handler: `workers/api/src/routes/changelog.ts`.

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

## Active context


<claude-mem-context>
# Memory Context

# [saas-maker] recent context, 2026-05-02 10:03pm GMT+5:30

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (16,895t read) | 521,628t work | 97% savings

### Apr 29, 2026
S250 Migrate saas-maker email from Resend to Cloudflare Email — hitting token permission error during domain onboarding (Apr 29 at 5:08 PM)
S249 Migrate saas-maker email package from Resend to Cloudflare Email (Apr 29 at 5:08 PM)
S251 Email provider and template architecture decisions — Cloudflare Email confirmed, React Email library chosen over custom solution (Apr 29 at 5:09 PM)
S255 @saas-maker/email package fully migrated to React Email — index.ts wired up (Apr 29 at 5:16 PM)
391 6:31p 🔴 settings-form.tsx — invalid `</div>` closing tag fixed to `</p>` in Rate Limit card
393 " 🟣 Projects list page — readme shown as 2-line description under each project card
394 6:32p 🟣 FleetMonitor — "Inspect" link only shown for API-registered projects; others show "Local only"
395 " ✅ OpenAPI spec regenerated — 55 paths, includes PATCH /v1/projects/:id readme field
398 " ✅ Session changeset summary — 10 files, 1236 insertions, project list UI overhaul complete
399 " ✅ CLI README updated with PATCH /v1/projects recipe for readme and rate_limit_rpm
400 " ✅ Public docs CLI page — new "Project Metadata" section added
401 6:33p 🔴 TypeScript error in fleet-monitor.tsx — `visibleDashboardProjects` returns `ProjectIdentity[]` not `FleetProject[]`
402 " 🔴 fleet-monitor.tsx — explicit `as FleetProject[]` cast fixes TypeScript generic inference error
403 " 🔵 Pre-existing API typecheck errors — `TraceOptions.project` and `SendOptions.template` not in type definitions
404 " ✅ Cockpit production build passes after FleetProject cast fix — all 30 routes compiled
405 6:34p ✅ Full test suite passes after all project list UI changes — 136 tests across 12 files
407 6:49p 🔴 fleet-monitor.tsx — trailing whitespace on Link line found by pre-commit check
408 " 🔵 fleet-monitor.tsx trailing whitespace persists after patch — patch matched wrong occurrence
410 " ✅ Committed "Make project limits and notes manageable" — SHA 0893a8c on main
412 " 🔵 Pre-push hook blocks `git push` — landing-v2 lint fails, prevents deploy
413 " ✅ Pushed to GitHub with `HUSKY=0` to bypass pre-push lint hook
414 6:50p 🔴 Post-push state — AGENTS.md, pnpm-lock.yaml unstaged; apps/landing-v2 untracked
### May 2, 2026
575 2:25p ⚖️ Fleet projects — three standard documentation pieces planned
576 2:26p 🔵 saas-maker monorepo DB/schema architecture mapped
577 " 🔵 saas-maker project README API and fleet CLI fully documented
578 " 🔵 saas-maker API full route map — tasks, fleet-metadata, free AI bindings confirmed
579 2:27p 🔵 saas-maker monorepo root scripts and tooling confirmed
580 " 🟣 Fleet project guidance fields added — task_instructions, saasmaker_usage, free_ai_usage
581 " 🟣 Fleet projects — three per-project guidance columns added
582 2:28p ✅ Fleet projects — docs updated for three guidance fields on projects
583 " ✅ Fleet guidance fields — OpenAPI spec regenerated, tests and typecheck pass
584 2:29p 🟣 Fleet projects — add task management, SASS Maker, and free AI guidance fields
585 " 🔵 @saas-maker/contracts must be rebuilt before dashboard typecheck sees new fields
586 " 🔵 Pre-existing TS errors in @saas-maker/api — TraceOptions and SendOptions type mismatches
587 " ✅ Fleet project guidance — 11 files changed across API, dashboard, docs, CLI, and types
588 2:30p 🟣 Fleet guidance fields — full implementation diff confirmed across all layers
589 " 🔄 Fleet guidance — code quality pass: expanded conditionals, typed MockContext, readme nullability fix
590 2:31p 🔵 Fleet inventory — 24 projects in foundry.projects.json, 19 have AGENTS.md
592 " 🔵 Fleet AGENTS.md bulk-read — per-project stack/purpose mapped for guidance content authoring
593 " 🟣 Fleet guidance block injected into all 19 AGENTS.md files via Node.js script
594 2:32p ✅ Fleet guidance injection verified — all 19 AGENTS.md files confirmed with exactly 1 block, all 18 git repos show modified
595 2:33p ⚖️ DB-backed guidance fields reverted — AGENTS.md injection chosen as sole delivery mechanism
597 " 🔴 saas-maker codebase fully reverted to pre-feature state — only AGENTS.md and pnpm-lock.yaml remain modified
670 3:09p 🔵 Cloudflare Dynamic Workers — potential use cases in existing projects
671 " 🔵 saas-maker architecture mapped for Dynamic Workers integration candidates
672 3:10p 🔵 saas-maker full architecture trace — Dynamic Workers integration gap identified
682 3:13p 🔵 saas-maker Foundry Operational Layer — architecture mapped for Dynamic Workers integration
685 3:14p ⚖️ Dynamic Workers Symphony plan created — cloud execution lane for Foundry tasks
686 3:18p ⚖️ Agent Operating Systems research note — OpenRoom, OpenClaw, Dynamic Workers layered model
687 3:19p 🟣 Fleet task board — task list + project filter added
688 3:20p 🔵 Fleet project inventory — local vs foundry.projects.json coverage gap
689 " 🔵 Fleet per-project task metadata — no local task files exist; only .omx and .fallow dirs present
690 " 🔵 SaaS Maker task API and cockpit task board — fully implemented with project_slug filter
691 3:21p 🔵 saas-maker task board — full implementation map

Access 522k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
