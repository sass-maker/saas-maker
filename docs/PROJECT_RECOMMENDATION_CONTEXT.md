# Project Recommendation Context

Generated: 2026-06-09T14:35:00.000Z

This file is a CodeVetter Repo Unpacked-inspired audit written for Starboard recommendations. It is intentionally local, evidence-oriented, and safe to commit: it records product context, feature areas, stack inventory, and recommendation guidance without secrets or environment values.

## Project Identity

- Slug: `saas-maker`
- Registry description: Foundry — The Industrial Software Factory for Project Fleets.
- Product grouping: `internal-first`
- Source path: `saas-maker`

## Product Context

Foundry — The Industrial Software Factory for Project Fleets.

SaaS Maker is the foundry helper for the fleet: a Cloudflare-first monorepo with the API, cockpit, docs, widgets, reusable blocks, CLI, and experimental Droid surface that coordinate product tasks, task-linked LLM workflows, and fleet operations. Droid loop policies now run bounded retries with per-attempt events, blocker-aware stops, retry-on-failure controls, and max-attempt exhaustion reporting.

SaaS Maker SaaS Maker is a TypeScript monorepo for building and operating small SaaS products across a project fleet. It includes a Cloudflare Workers API, a Next.js cockpit, embeddable widgets, shared backend blocks, documentation, and an experimental autonomous runner called Droid. The repo is public, but parts of the deployment are still personal/internal. Treat this as an active product workspace rather than a polished framework release. Deployment & External Services Everything is hosted on Cloudflare. Each deployable ships independently via GitHub Actions .github/workflows/ci.yml on push to main , gated by changed paths. Deployable Source Host ----------------- --------------- --------

## Feature Map

- **AI agents**: Agents, tool use, workflows, orchestration, RAG, evals, and model integration. Keywords: ai, agent, agents, llm, rag, embedding, eval, model.
- **UI workflows**: Dashboards, tables, forms, component systems, charts, and user workflows. Keywords: ui, ux, dashboard, table, component, react, next, tailwind.
- **Cloudflare and deploy**: Workers, Pages, edge runtime, queues, storage, and deploy automation. Keywords: cloudflare, worker, workers, pages, edge, deploy, wrangler, queue.
- **Database and storage**: SQL, document storage, migrations, cache, queues, vectors, and persistence. Keywords: database, db, sql, sqlite, postgres, turso, libsql, drizzle.
- **Testing and quality**: Unit tests, browser tests, evals, CI quality gates, and regression checks. Keywords: test, testing, quality, vitest, playwright, ci, eval, benchmark.
- **Content and media**: Content production, video, reels, documents, markdown, and publishing workflows. Keywords: content, media, video, reel, markdown, document, publish, editor.
- **Search and discovery**: Search, ranking, recommendations, feeds, semantic retrieval, and discovery UX. Keywords: search, discovery, recommend, ranking, semantic, feed, index, retrieval.

## Runtime Surfaces and Entrypoints

- `apps/cockpit/src/app/(app)/layout.tsx`
- `apps/cockpit/src/app/layout.tsx`
- `apps/cockpit/src/app/login/page.tsx`
- `apps/cockpit/src/app/page.tsx`
- `apps/cockpit/src/app/api/cockpit/task-workflows/route.ts`
- `apps/cockpit/src/app/api/task-workflows/[id]/runs/route.ts`
- `apps/cockpit/src/app/workflow-artifacts/[shareToken]/page.tsx`
- `apps/cockpit/src/components/tasks/TaskDetailClient.tsx`
- `apps/showcase/src/pages/index.astro`
- `scripts/check-fleet-contract-sync.mjs`
- `scripts/lib/fleet-health-contracts.mjs`
- `workers/api/src/index.ts`
- `workers/api/src/routes/ai.ts`
- `workers/api/src/routes/auth.ts`
- `workers/api/src/routes/changelog.ts`
- `workers/api/src/routes/cli-auth.ts`
- `workers/api/src/routes/feedback.ts`
- `workers/api/src/routes/fleet-metadata.ts`
- `workers/api/src/routes/jobs.ts`
- `workers/api/src/routes/knowledge.ts`
- `workers/api/src/routes/marketing.ts`
- `workers/api/src/routes/projects.ts`
- `workers/api/src/routes/roadmap.ts`
- `workers/api/src/routes/secrets.ts`
- `workers/api/src/routes/standards.ts`
- `workers/api/src/routes/symphony.ts`
- `workers/api/src/routes/task-workflows.ts`
- `workers/api/src/routes/tasks.ts`
- `workers/api/src/routes/test.ts`
- `workers/api/src/routes/testimonials.ts`
- `workers/api/src/routes/upload.ts`
- `workers/api/src/routes/waitlist.ts`
- `workers/droid/src/index.ts`

## Current Stack

- Languages: `Astro`, `TypeScript`
- Frameworks/tools: `Astro`, `Cloudflare Workers`, `Drizzle`, `Next.js`, `OpenNext Cloudflare`, `Playwright`, `React`, `Tailwind CSS`, `Vitest`
- Config files:
- `apps/cockpit/next.config.ts`
- `apps/cockpit/wrangler.toml`
- `apps/docs/astro.config.mjs`
- `apps/showcase/astro.config.mjs`
- `apps/showcase/wrangler.toml`
- `packages/blocks/ops/vitest.config.ts`
- `packages/cli/templates/next/tailwind.config.ts`
- `packages/cli/vitest.config.ts`
- `packages/tooling/tailwind-preset/vitest.config.ts`
- `packages/tooling/test-config/vitest.config.ts`
- `playwright.config.ts`
- `standards/hardening/mobile-kit/playwright.config.ts.template`
- `vitest.config.ts`
- `workers/api/wrangler.toml`
- `workers/droid/wrangler.jsonc`

## OSS Already In Use

Direct dependencies:
- `@astrojs/sitemap`
- `@astrojs/starlight`
- `@cloudflare/playwright`
- `@cloudflare/sandbox`
- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@dnd-kit/utilities`
- `@eslint/js`
- `@libsql/client`
- `@radix-ui/react-slot`
- `@saas-maker/db`
- `@saas-maker/email`
- `@saas-maker/eslint-plugin-fallow`
- `@saas-maker/ops`
- `@saas-maker/sdk`
- `@saas-maker/shared-types`
- `@saas-maker/ui`
- `astro`
- `better-auth`
- `chalk`
- `class-variance-authority`
- `clsx`
- `commander`
- `date-fns`
- `drizzle-orm`
- `eslint-config-prettier`
- `eslint-plugin-import`
- `eslint-plugin-promise`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`
- `eslint-plugin-simple-import-sort`
- `globals`
- `hono`
- `husky`
- `jose`
- `lucide-react`
- `next`
- `next-themes`
- `nodemailer`
- `ora`
- `posthog-js`
- `prettier-plugin-tailwindcss`
- `radix-ui`
- `react`
- `react-dom`
- `sharp`
- `sonner`
- `tailwind-merge`
- `typescript`
- `typescript-eslint`

Development dependencies:
- `@axe-core/playwright`
- `@cloudflare/workers-types`
- `@eslint/js`
- `@opennextjs/cloudflare`
- `@playwright/test`
- `@saas-maker/eslint-config`
- `@saas-maker/prettier-config`
- `@saas-maker/tsconfig`
- `@storybook/addon-essentials`
- `@storybook/addon-interactions`
- `@storybook/addon-links`
- `@storybook/addon-onboarding`
- `@storybook/blocks`
- `@storybook/react`
- `@storybook/react-vite`
- `@storybook/test`
- `@tailwindcss/postcss`
- `@types/node`
- `@types/nodemailer`
- `@types/react`
- `@types/react-dom`
- `@vitest/coverage-v8`
- `babel-plugin-react-compiler`
- `drizzle-kit`
- `eslint`
- `eslint-config-next`
- `husky`
- `lighthouse`
- `lightningcss`
- `prettier`
- `prettier-plugin-tailwindcss`
- `react`
- `react-dom`
- `shadcn`
- `storybook`
- `tailwindcss`
- `tsup`
- `tsx`
- `tw-animate-css`
- `typescript`
- `vitest`
- `wrangler`

Package scripts:
- `astro`
- `bootstrap:cloudflare`
- `build`
- `build-storybook`
- `build:api`
- `build:cockpit`
- `build:db`
- `build:docs`
- `build:email`
- `build:next`
- `build:showcase`
- `build:types`
- `build:widget`
- `cf:build`
- `check:cloudflare`
- `check:openapi`
- `deploy`
- `dev`
- `dev:api`
- `dev:cockpit`
- `dev:cockpit:local`
- `dev:cockpit:prod`
- `droid:local`
- `fleet:audit`
- `fleet:cf-builds`
- `fleet:clone`
- `fleet:monitoring-audit`
- `fleet:prod-smoke`
- `fleet:secret-audit`
- `generate:openapi`
- `lint`
- `postinstall`
- `prebuild`
- `predev`
- `prepare`
- `preview`
- `smoke`
- `smoke:artifact`
- `start`
- `storybook`
- `symphony`
- `symphony:agent-usage`
- `symphony:import-failures`
- `symphony:normalize-weekly`
- `symphony:runner`
- `test`
- `test:e2e`
- `test:integration`
- `typecheck`

## Testing and Quality Signals

- `packages/blocks/ops/src/__tests__/trace.test.ts`
- `packages/blocks/ops/vitest.config.ts`
- `packages/cli/src/commands/__tests__/forge.test.ts`
- `packages/cli/src/commands/__tests__/init.test.ts`
- `packages/cli/src/lib/__tests__/drift.test.ts`
- `packages/cli/src/lib/__tests__/fleet.test.ts`
- `packages/cli/vitest.config.ts`
- `packages/tooling/tailwind-preset/src/__tests__/preset.test.ts`
- `packages/tooling/tailwind-preset/vitest.config.ts`
- `packages/tooling/test-config/src/__tests__/factories.test.ts`
- `packages/tooling/test-config/vitest.config.ts`
- `playwright.config.ts`
- `standards/hardening/mobile-kit/playwright.config.ts.template`
- `tests/api/ai-gateway.test.ts`
- `tests/api/changelog.test.ts`
- `tests/api/feedback-flow.test.ts`
- `tests/api/feedback-validation.test.ts`
- `tests/api/fleet-today.test.ts`
- `tests/api/helpers.ts`
- `tests/api/knowledge.test.ts`
- `tests/api/marketing.test.ts`
- `tests/api/roadmap.test.ts`
- `tests/api/tasks.test.ts`
- `tests/api/ua.test.ts`
- `tests/api/waitlist.test.ts`
- `tests/cli/api-command.test.ts`
- `tests/cli/doctor-status.test.ts`
- `tests/cli/fleet.test.ts`
- `tests/cli/projects.test.ts`
- `tests/cli/request-auth.test.ts`
- `tests/cli/symphony-audit.test.ts`
- `tests/cli/symphony-pick.test.ts`
- `tests/cli/symphony-reporting.test.ts`
- `tests/cockpit-ai-gateway.test.ts`
- `tests/cockpit-fleet-health.test.ts`
- `tests/cockpit-symphony.test.ts`
- `tests/cockpit-tasks-boundary.test.ts`
- `tests/droid/acceptance.test.ts`
- `tests/droid/patch.test.ts`
- `tests/droid/pr-gate.test.ts`
- `tests/droid/runs.test.ts`
- `tests/e2e/api/auth-chain.spec.ts`

## Recommendation Guidance

Good matches:
- Repos that strengthen ai agents without replacing already-installed libraries.
- Repos that strengthen ui workflows without replacing already-installed libraries.
- Repos that strengthen cloudflare and deploy without replacing already-installed libraries.
- Repos that strengthen database and storage without replacing already-installed libraries.
- Repos that strengthen testing and quality without replacing already-installed libraries.
- Repos that strengthen content and media without replacing already-installed libraries.
- Repos that strengthen search and discovery without replacing already-installed libraries.
- Tools with concrete support for api, workers, src, github.com, sarthak-fleet, product, cloudflare, routes.
- Implementation repos, SDKs, CLIs, testing utilities, adapters, and focused libraries are higher value than generic awesome lists.
- Treat `foundry.projects.json` as the fleet registry source of truth and run `pnpm check:fleet-contracts` after adding or retiring active project roots.

Avoid recommending:
- Do not recommend packages already listed under direct or development dependencies unless the task is migration research.
- Do not recommend broad framework replacements unless the project context explicitly calls for a rewrite.
- Downrank curated lists, archived repos, stale demos, and generic UI kits that do not map to the feature catalog.

## Evidence Read

Primary docs and handoff files:
- `AGENTS.md`
- `PROJECT_STATUS.md`
- `README.md`
- `docs/IDEA-DUMP.md`
- `docs/README.md`
- `docs/always-on-automation-setup.md`
- `docs/baseline-2026-04-27.md`
- `docs/cf-shields-state.md`
- `docs/droid-roadmap.md`
- `docs/droid.md`
- `docs/fleet-canonical-projects.md`
- `docs/migration-plan.md`
- `docs/stale-artifact-review.md`
- `docs/symphony.md`
- `docs/task-cloud-audit.md`
- `docs/testing-backlog.md`
- `docs/tooling-plan.md`

Package manifests:
- `apps/cockpit/package.json`
- `apps/docs/package.json`
- `apps/showcase/package.json`
- `package.json`
- `packages/blocks/db/package.json`
- `packages/blocks/email/package.json`
- `packages/blocks/ops/package.json`
- `packages/blocks/sdk/package.json`
- `packages/blocks/shared-types/package.json`
- `packages/cli/package.json`
- `packages/tooling/dev-config/package.json`
- `packages/tooling/eslint-config/package.json`
- `packages/tooling/eslint-plugin-fallow/package.json`
- `packages/tooling/prettier-config/package.json`
- `packages/tooling/renovate-config/package.json`
- `packages/tooling/tailwind-preset/package.json`
- `packages/tooling/test-config/package.json`
- `packages/tooling/tsconfig/package.json`
- `packages/ui/package.json`
- `packages/widgets/changelog-widget/package.json`
- `packages/widgets/feedback-widget/package.json`
- `packages/widgets/testimonials-widget/package.json`
- `packages/widgets/waitlist-widget/package.json`
- `workers/api/package.json`
- `workers/droid/package.json`

Inventory notes:
- Files scanned: 611
- This pass uses deterministic repo inventory plus local documentation/source-path evidence. It does not claim a full manual line-by-line review of every source file.

## Confidence

Confidence: **high**

Why:
- PROJECT_STATUS.md present
- README.md present
- 26 entrypoint/runtime files identified
- package dependencies inventoried
- 42 test/quality files identified

Refresh command:

```bash
cd /Users/sarthak/Desktop/fleet/starboard
pnpm fleet:audit-recommendation-context
pnpm fleet:extract-projects
```
