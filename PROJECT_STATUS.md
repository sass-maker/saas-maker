# saas-maker — PROJECT STATUS

Last updated: 2026-07-19

## Why / What

SaaS Maker is the Foundry for the fleet: a Cloudflare-first monorepo with the public product directory and the private Build, Market, Learn, Visibility, and Control plane. It owns the canonical catalog, API, cockpit, package docs, indexed skills, widgets, packages, fleet operations, imported helpers, and experimental Droid surface.

**Users:** Fleet operators in Cockpit; spoke projects pushing events/results via API; CLI users via `fnd`; docs/showcase readers.

**Constraints:** Hub-and-spoke rule — spokes push up to SaaS Maker; spokes do not call each other directly. Production domain uses double-s `sassmaker.com`. In-API knowledge/RAG fully removed from SaaS Maker (not delegated elsewhere from this control plane).

**IN scope:** API `/v1/*`, Cockpit dashboard, Droid experimental runner, docs/showcase, CLI, widgets, marketing queue, events hub, fleet registry/contracts, Task Workflows MVP.

**OUT of scope:** Droid as daily-driver for all workflows, production cron/AI for block prototypes without owners, owner email notifications (pending Cloudflare Email Workers), long-term portfolio program Phases 0/2–4, knowledge/RAG in SaaS Maker.

## Dependencies

### External

- **Cloudflare D1:** `saasmaker-db` — shared by API, Cockpit, Droid.
- **Cloudflare R2:** `saasmaker-feedback-images`.
- **Cloudflare Workers AI:** API AI binding; Droid uses DeepSeek models.
- **better-auth + Google:** Cockpit session; API validates D1 session table.
- **PostHog:** Analytics; API telemetry inlined (`workers/api/src/lib/telemetry.ts`).
- **GitHub Actions:** Build/test on pull requests and `main`; production jobs require explicit manual dispatch.

### Internal (fleet)

| Service | Role |
| --- | --- |
| **reel-pipeline** | Marketing queue pull/PATCH; hostname typo fixed to `api.sassmaker.com` |
| **Fleet catalog** | `catalog/foundry.json` — sole hand-edited source; public and legacy views are generated and drift-checked. |

### Stack & commands

**Stack:** pnpm workspaces · Turbo · Vitest (375 root tests) · Playwright e2e · Cloudflare D1 `saasmaker-db` · R2 · Workers AI · better-auth + Google · PostHog · Hono API · Next.js Cockpit · Astro docs/showcase · Containers+DO Droid.

| Deployable | Source | Worker/Pages name | Domain |
| --- | --- | --- | --- |
| API | `workers/api` | `saasmaker-api` | `api.sassmaker.com` |
| Cockpit (current) | `apps/cockpit` | `saasmaker-dashboard` | `app.sassmaker.com` |
| Foundry cockpit (target) | `apps/cockpit` | existing manual host; parity pending | `fleet.sassmaker.com` |
| Droid | `workers/droid` | `saasmaker-droid` | `*.workers.dev` |
| Package docs | `docs/` public subset + `apps/docs-blume` | target `saas-maker-packages` | `packages.sassmaker.com` |
| Skills | `apps/skills` + `skills/` | target `saas-maker-skills` | `skills.sassmaker.com` |
| Showcase | `apps/showcase` | `saas-maker-home` (Pages) | `sassmaker.com` |
| CLI | `packages/cli` | — | `fnd` command |
| Blocks | `packages/blocks` | — | SDK (`@saas-maker/sdk`); internal contracts in `internal/contracts/` |
| Widgets | `packages/widgets` | — | feedback, changelog, testimonials, waitlist |
| Contracts | `internal/contracts/` | — | internal API/Cockpit types (`@saas-maker/contracts`) |

| Command | Purpose |
| --- | --- |
| `pnpm install` / `pnpm test` / `pnpm test:integration` / `pnpm test:e2e` | Install + vitest + integration + playwright |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | TS + lint + turbo build |
| `pnpm dev:api` / `dev:cockpit` / `dev:cockpit:local` / `dev:cockpit:prod` | Local dev surfaces |
| `pnpm build:api` / `build:cockpit` / `build:docs` / `build:showcase` / `build:skills` / `build:widget` | Per-app builds |
| `pnpm components:install` / `components:check` | Locked setup and native checks for imported Mobile Dev Cockpit, Drank, PSI Swarm, and Reel Pipeline sources |
| `pnpm catalog:validate` / `catalog:check` / `observability:inventory` / `host:test` | Canonical catalog, evidence inventory, and operations-host safety |
| `pnpm generate:openapi` / `check:openapi` | OpenAPI |
| `pnpm check:fleet-contracts` / `fleet:prod-smoke` / `fleet:secret-audit` / `fleet:monitoring-audit` / `fleet:posthog-verify` / `fleet:audit` / `fleet:clone` / `fleet:cf-builds` / `smoke` | Fleet operations |
| `pnpm symphony` / `symphony:runner` / `droid:local` | Symphony / Droid local |
| `pnpm bootstrap:cloudflare` / `check:cloudflare` / `smoke:artifact` | Reel-pipeline helpers |

Brand note: production domain uses **double-s** `sassmaker.com`; display name remains SaaS Maker.

## Timeline

- **2026-07-19 — Foundry source consolidation:** Imported Mobile Dev Cockpit, Drank, Reel Pipeline, Fleet Ops, and PSI Swarm with provenance-preserving history; established `catalog/foundry.json` as the sole hand-edited catalog; generated public and compatibility projections; added the provider-neutral observability contract and Cockpit coverage page; added an inert operations-host lease foundation; separated Blume package docs from the apex; and added the indexed skills site. Local source validation is complete. Production deployment, DNS, manual-host parity, shared lease storage, scheduler installation, and old-repository archival remain separate explicit cutover decisions.

- **2026-07-12 — Two-stage marketing approvals:** Cockpit recognizes Reel
  Pipeline's versioned distribution envelopes, keeps content acceptance separate
  from posting approval, exposes `Approve & schedule` only after a media receipt
  exists, and hides manual sent/status shortcuts for managed rows. Queue summaries
  now include durable render, schedule, retry, failure, and platform receipt state
  without a D1 migration or unpublished-copy leak.

- **2026-07-11 — Fleet deploy/audit alignment:** Restored the reusable Cloudflare deploy workflow contract with Node 22 defaults and aligned fleet-audit local checkout resolution and business lanes to the canonical project slugs.
- **2026-07-13 — Canonical Fleet health contracts:** Moved production smoke and audit targets to the owned product domains, folded Reel Pipeline visibility into `fleet.sassmaker.com/marketing`, and allowed shared widgets from `*.significanthobbies.com`.
- **2026-07-18 — Spotlight directory sync:** Marked the four public spotlight products in the canonical catalog; the Fleet Sync Guard checks SaaS Maker against the canonical fleet contract while preserving the full maintained directory.
- **2026-07-13 — Stable LoopTV smoke:** Classified Chromium's optional YouTube `compute-pressure` permissions warning as non-fatal while retaining iframe and playback interaction checks.
- **2026-07-03 — Droid graduation:** Droid now records durable retry and timeout contracts as run events (every run declares its retry/backoff/timeout behaviour up front). Pre-flight validation fails fast with categorized reasons (git clean state, dependencies installed) before the main task runs. New `/v0/dashboard/success-rate` endpoint computes a rolling 7-day success-rate dashboard with failure-reason breakdown and retry-count distribution. Migration `0022_droid_graduation.sql` adds `retry_count` and `failure_reason` columns + indexes. Backoff strategies (fixed/linear/exponential) with jitter configurable via loop_policy.
- **2026-07-03 — Marketing posting ops summary:** Cockpit marketing queue now
  derives missed ready posts, reel-pipeline posting failures, synced
  YouTube/Instagram metrics, and metrics-pending posts from marketing post
  notes. Summary cards and an Ops filter make those states actionable without
  adding a separate Reel Pipeline dashboard.
- **2026-06-20 — Knowledge/RAG removal:** Deleted `/v1/knowledge/*`, Cockpit knowledge UI, SDK `KnowledgeService`, API RAG bindings, and D1 knowledge tables (`0021_drop_knowledge.sql`, applied to remote `saasmaker-db` 2026-06-20). SaaS Maker is not a search/RAG hub. Deleted `packages/tooling/*` (eslint-config, prettier-config, tsconfig, astro-landing, eslint-plugin-fallow), `packages/blocks/ops`, and shelved `packages/blocks/views/`. Cockpit astro overlay script is local under `apps/cockpit/scripts/`. npm scope: **26 retired packages deprecated on npm** (2026-06-20); **6 active** (`sdk`, `cli`, `feedback`, `testimonials`, `changelog-widget`, `waitlist`).
- **2026-06-20 — Fleet tooling merge:** Tooling decoupling merged to `main` on starboard, high-signal, linkchat, significanthobbies, and CodeVetter; free-ai, truehire, resume-tailor already on main.
- **2026-06-20 — Internal contracts collapse:** Removed `@saas-maker/db` (unused) and `@saas-maker/shared-types` package; API/Cockpit types live in `internal/contracts/` (path alias `@saas-maker/contracts`). Public API types remain in `@saas-maker/sdk`.
- **2026-06-20 — Email package removal:** Orphaned `@saas-maker/email` package removed; Resend sends removed from feedback/waitlist routes.
- **2026-06-20 — Fleet events hub shipped:** Append-only spoke push-up sink at `/v1/events`; batch ingest with idempotency keys; owner-scoped via session/API auth.
- **2026-06-20 — reel-pipeline integration verified:** Marketing queue pull accepted items; PATCH rendered artifacts back; hostname typo fixed to `api.sassmaker.com`.
- **2026-06-20 — CI / turbo recovery:** Restored `turbo.json`; fixed CI pnpm version conflict; removed dead `build:email` steps; root tests back on `vitest run` (320 tests).
- **2026-06-20 — Long-term API contract Phase 1 shipped:** `/v1/*` API contract (tasks, marketing, feedback, changelog, fleet metadata, events, workflows). Phases 0, 2–4 deferred as program work.

## Products

| Surface | URL |
| --- | --- |
| API | `https://api.sassmaker.com` |
| Cockpit (current) | `https://app.sassmaker.com` |
| Foundry cockpit (target) | `https://fleet.sassmaker.com` |
| Marketing home | `https://sassmaker.com` |
| Package docs (target) | `https://packages.sassmaker.com` |
| Skills (target) | `https://skills.sassmaker.com` |
| Droid | `https://saasmaker-droid.sarthakagrawal927.workers.dev` |
| Health | `GET https://api.sassmaker.com/health` |

## Features (shipped)

### Architecture

- Operator (browser + `fnd` CLI) → Cockpit (`app.sassmaker.com` current, `fleet.sassmaker.com` target), API (`api.sassmaker.com`), directory (`sassmaker.com`), package docs (`packages.sassmaker.com` target), and skills (`skills.sassmaker.com` target).
- Cockpit uses better-auth session; API accepts `X-Project-Key` / Bearer `sm_*` plus session validation against D1.
- Shared D1 `saasmaker-db` (Drizzle ORM): tasks, projects, marketing, events, workflows.
- Droid (`saasmaker-droid`): Containers + Durable Objects experimental sandbox runner.
- R2 feedback images, Workers AI binding, PostHog telemetry inlined in API.
- Fleet spokes (reel-pipeline, CodeVetter, fleet products) push up via `/v1/*` + widgets — no spoke-to-spoke calls.
- Hub-and-spoke: reel-pipeline ⇄ marketing queue is the reference integration pattern.

### API (`workers/api`)

- Hono app with CORS allowlist (`*.sassmaker.com`, `*.significanthobbies.com`, localhost, `*.workers.dev`, `*.pages.dev`).
- Rate limit middleware on `/v1/*` (100/min; `/v1/ai` skipped).
- Routes live: auth, projects, feedback, upload, waitlist, ai, testimonials, changelog, cli-auth, secrets, jobs, roadmap, standards, fleet-metadata, tasks, task-workflows, symphony, marketing, events, test.
- Project readme GET/PUT for SDK (`/v1/projects/readme`).
- PostHog exception capture on unhandled errors.
- **Removed 2026-06-20**: `/v1/knowledge/*`, in-API vector search, RAG service bindings.

### Cockpit (`apps/cockpit`)

- Next.js dashboard: projects, tasks, fleet state, marketing posts, Droid runs.
- Marketing queue summary cards flag missed ready posts, posting failures,
  synced post metrics, and posts waiting for metrics backfill, with an Ops
  filter for narrowing the queue to those states.
- Task board with product vs marketing workstream filter.
- Task Workflows MVP: Markdown context + prompt templates; run via Droid native mode; stable share pages for saved Markdown artifacts.
- Sidebar nav includes `/marketing`.

### Droid (`workers/droid`)

- Experimental Cloudflare Sandbox runner (Containers + Durable Objects).
- Loop policies: bounded retries, per-attempt events, blocker-aware stops, retry-on-failure controls, max-attempt exhaustion reporting.
- Can run sandboxed tasks and create draft PRs — not a polished daily-driver for all workflows.

### Docs & showcase

- Blume package docs build from a fixed public allowlist in the canonical root `docs/` tree; internal operations and planning content is excluded.
- Static showcase at `sassmaker.com` builds from `catalog/generated/public.json`, preserving the four-product front door and the full maintained directory with product, source, changelog, and roadmap links.
- The skills site builds an indexed public catalog from `catalog/generated/skills.json`, including `llms.txt`, `/index.md`, `/api/ai`, robots, and sitemap surfaces.

### CLI (`packages/cli`, `fnd`)

- Generated OpenAPI-backed CLI for all `/v1/*` endpoints.
- Session auth flow: `POST /v1/cli/code` → approve at cockpit → poll token.

### Widgets & blocks

- Embeddable feedback, changelog, testimonials, waitlist widgets (`packages/widgets`).
- `@saas-maker/sdk` — public client for fleet products.
- **Removed 2026-06-20**: orphaned `@saas-maker/email` package; Resend sends removed from feedback/waitlist routes.
- **Removed 2026-06-20**: shelved ops block prototypes (Magic Form Builder, AI Feedback Digest) with `packages/blocks/ops/` deletion.

### Marketing queue (`/v1/marketing/posts`)

- Channels: tiktok, instagram_reels, youtube_shorts, blog, email, producthunt, x, reddit, other.
- Statuses: generated → accepted → rejected → sent.
- Sources: manual, task, changelog.
- Fields: title, hook, body, cta, asset_url, result_url, task_id, scheduled_for, posted_at.
- **reel-pipeline integration verified 2026-06-20**: pull accepted items, PATCH rendered artifacts back.
- **reel-pipeline posting ops visible 2026-07-03**: Cockpit parses structured
  reel-pipeline notes for missed posts, posting failures, platform release IDs,
  and YouTube/Instagram metrics blocks.

### Fleet events hub (`/v1/events`)

- Append-only spoke push-up sink (2026-06-20).
- Batch ingest with idempotency keys; owner-scoped via session/API auth.
- Task queue + worker SDK patterns for fleet project auth/integration.

### Task Workflows (`/v1/task-workflows`)

- CRUD for workflow definitions tied to tasks/projects.
- Artifact storage with share tokens for Markdown outputs.
- Cockpit task detail runs workflows through Droid.

### Fleet catalog & contracts

- `catalog/foundry.json` is the sole hand-edited source for products, components, domains, repositories, packages, skills, automations, ownership, lifecycle, and observability contracts.
- `foundry.projects.json`, `ops/config/projects.json`, `ops/config/automation-registry.json`, and `catalog/generated/*` are generated compatibility views.
- `pnpm check:fleet-contracts` syncs the generated compatibility registry with canonical docs and production health contracts; sibling checkout names are not a source of truth.
- Production smoke: cockpit, home, docs, auth endpoints.

## Todo / Planned / Deferred / Blocked

### Planned

1. Perform an explicitly approved production cutover for package docs, skills, and the private Foundry cockpit only after deploy-identity, binding, live parity, smoke, and rollback evidence is attached.
2. Replace the local-file-only host lease with a central/shared lease adapter before promoting the other machine or installing any scheduler.
3. Keep `catalog/foundry.json`, README, AGENTS guidance, project status, health contracts, and public views synchronized through the generator rather than duplicate editing.
4. Tighten Task Workflows after real use: automatic Droid result capture, richer run status/events, clearer artifact lifecycle controls.
5. Continue reducing stale deploy/docs references when concrete drift is found.

### Deferred

- Droid remains experimental; Task Workflows is the first concrete fleet workflow using Droid from Cockpit.
- Automatic task creation from AI feedback deferred; humans review digest output first.
- Production cron/AI workflows for block prototypes parked until clear owners and rollback paths exist.
- Long-term portfolio program (Phases 0, 2–4 from archived PRD).
- Magic Form Builder and AI Feedback Digest shelved prototypes removed with `packages/blocks/ops/` (2026-06-20); not production features.
- Droid v1 experimental — not a polished daily-driver for all fleet workflows.
- Deprecated analytics endpoint noted in fleet smoke: `/v1/analytics/events`.

### Blocked

- Production cutover is intentionally blocked on explicit approval plus live deploy/parity/rollback evidence; local source completion is not deployment authorization.
- Designated-host activation is blocked on a central/shared lease store and machine-specific role setup; the checked-in foundation remains inert.
- Owner email notifications for feedback/waitlist parked pending Cloudflare Email Workers provider work.
- Email notifications removed with `@saas-maker/email`; Cloudflare Email Workers migration not complete.
