# Project Recommendation Context

Generated: 2026-06-06T21:14:19.605Z

This file is a CodeVetter Repo Unpacked-inspired audit written for Starboard recommendations. It is intentionally local, evidence-oriented, and safe to commit: it records product context, feature areas, stack inventory, and recommendation guidance without secrets or environment values.

## Project Identity

- Slug: `reel-pipeline`
- Registry description: AI reel generation product that turns input text and project context into short-form video drafts and render artifacts.
- Product grouping: `internal-first`
- Source path: `reel-pipeline`

## Product Context

AI reel generation product that turns input text and project context into short-form video drafts and render artifacts.

Reel Pipeline is an AI reel generation product that turns input text and project context into reviewable short-form video drafts, render jobs, artifacts, and posting handoff. Its current internal inputs are SaaS Maker marketing ideas, High Signal reel briefs, and approved Significant Hobbies content envelopes. SaaS Maker remains the source of truth for queue acceptance and posting state; Significant Hobbies remains the source of truth for canonical article claims and creative approval.

For kids story reels, the current recommendation posture is intentionally
creator-first: validate three manually produced public-domain story videos
before recommending more software automation, dashboards, agents, auto-uploaders,
analytics scripts, or render-engine expansion. See `docs/creator-mvp.md` and
the complete manual packets under `docs/creator-mvp-packs/`.

For app marketing reels, recommendations should preserve the growth-format
experiment layer: 5-7 posts/day, review after 35 posts, and compare ranking,
sound-sync, tutorial, trend-copy, and before/after formats before adding broad
new tooling.

Reel Pipeline AI reel generation product that turns input text and project context into short-form video drafts and render artifacts. This repo owns the intake, draft, render, review, artifact, and posting-handoff flow for short-form video generation. Its internal inputs include accepted SaaS Maker Marketing Queue ideas, High Signal reel briefs, and versioned Significant Hobbies approved variants. Imported content provenance and approved scene payloads are preserved, while quality review, queue acceptance, posting preflight, and canonical content approval remain outside the importer's authority. Why This Repo Exists The fleet now has a marketing queue, but marketing docs alone are not enough. The useful loop is: 1. Agents create product-specific AI-video ideas in SaaS Maker Marketing Queue. 2. Sarthak accepts or rejects each idea in the UI. 3. Accepted

## Feature Map

- **Content and media**: Content production, video, reels, documents, markdown, and publishing workflows. Keywords: content, media, video, reel, markdown, document, publish, editor.
- **UI workflows**: Dashboards, tables, forms, component systems, charts, and user workflows. Keywords: ui, ux, dashboard, table, component, react, next, tailwind.
- **AI agents**: Agents, tool use, workflows, orchestration, RAG, evals, and model integration. Keywords: ai, agent, agents, llm, rag, embedding, eval, model.
- **Repo intelligence**: Repository understanding, metadata enrichment, code review, and evidence reports. Keywords: review, static, analysis, diff, history, evidence, verification.
- **Ingestion and sync**: External API ingestion, sync jobs, scraping, enrichment, and scheduled updates. Keywords: sync, ingest, ingestion, scrape, scraping, enrich, crawler, etl.
- **Analytics and intelligence**: Signal analysis, forecasting, monitoring, trends, metrics, and decision support. Keywords: analytics, intelligence, signal, forecast, monitoring, metric, trend, insight.
- **Cloudflare and deploy**: Workers, Pages, edge runtime, queues, storage, and deploy automation. Keywords: cloudflare, worker, workers, pages, edge, deploy, wrangler, queue.

## Runtime Surfaces and Entrypoints

- Not detected in this pass.

## Current Stack

- Languages: `Python`, `TypeScript`
- Frameworks/tools: `React`, `Tailwind CSS`
- Config files:
- `engines/MoneyPrinterTurbo/pyproject.toml`
- `engines/openshorts/dashboard/tailwind.config.js`
- `engines/openshorts/dashboard/vite.config.js`
- `wrangler.jsonc`

## OSS Already In Use

Direct dependencies:
- `@remotion/animation-utils`
- `@remotion/bundler`
- `@remotion/captions`
- `@remotion/cli`
- `@remotion/google-fonts`
- `@remotion/layout-utils`
- `@remotion/media`
- `@remotion/media-utils`
- `@remotion/player`
- `@remotion/renderer`
- `@remotion/web-renderer`
- `@remotion/zod-types`
- `express`
- `lucide-react`
- `msedge-tts`
- `react`
- `react-dom`
- `remotion`
- `uuid`
- `zod`

Development dependencies:
- `@ai-sdk/anthropic`
- `@ai-sdk/google`
- `@ai-sdk/openai`
- `@elevenlabs/elevenlabs-js`
- `@fal-ai/client`
- `@remotion/eslint-config-flat`
- `@types/express`
- `@types/prompts`
- `@types/react`
- `@types/react-dom`
- `@types/uuid`
- `@types/web`
- `@types/yargs`
- `@vitejs/plugin-react`
- `ai`
- `autoprefixer`
- `chalk`
- `dotenv`
- `eslint`
- `eslint-plugin-react`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`
- `ora`
- `postcss`
- `prettier`
- `prompts`
- `tailwindcss`
- `tsx`
- `typescript`
- `uuid`
- `vite`
- `yargs`

Package scripts:
- `batch`
- `bootstrap:cloudflare`
- `build`
- `canary:moneyprinter`
- `check:cloudflare`
- `dev`
- `draft:signal`
- `gen`
- `lint`
- `post:ready`
- `preview`
- `probe:engines`
- `render`
- `render:accepted`
- `render:pro`
- `smoke:artifact`
- `smoke:full`
- `smoke:mock`
- `smoke:reel-maker`
- `start`
- `studio`
- `sync:saasmaker`
- `test`
- `upgrade`
- `watch:render`
- `worker:dry-run`

## Testing and Quality Signals

- `engines/MoneyPrinterTurbo/test/README.md`
- `engines/MoneyPrinterTurbo/test/__init__.py`
- `engines/MoneyPrinterTurbo/test/services/__init__.py`
- `engines/MoneyPrinterTurbo/test/services/test_llm.py`
- `engines/MoneyPrinterTurbo/test/services/test_material.py`
- `engines/MoneyPrinterTurbo/test/services/test_state.py`
- `engines/MoneyPrinterTurbo/test/services/test_task.py`
- `engines/MoneyPrinterTurbo/test/services/test_video.py`
- `engines/MoneyPrinterTurbo/test/services/test_voice.py`
- `test/fixtures/accepted-marketing-posts.json`
- `test/fixtures/high-signal-reel-brief.json`
- `test/fixtures/post-ready-marketing-posts.json`
- `test/fixtures/saas-maker-improvement.json`
- `test/product-proof.test.js`
- `test/server.test.js`
- `test/signal-draft-generator.test.js`
- `test/signal-intake.test.js`
- `test/variants.test.js`
- `test/video-brief.test.js`
- `test/worker.test.js`

## Recommendation Guidance

Good matches:
- File-based, versioned content handoffs that retain canonical source attribution,
  exact approved scripts, idempotent receipts, comparable metrics, and
  draft-only feedback without creating a cross-repo writer or posting bypass.
- Manual creator-MVP support for kids story validation: source-rights notes,
  scene breakdowns, draft bundles, asset manifests, review checklists, and
  lightweight export handoff.
- Growth-format experimentation that improves draft metadata, format-level
  measurement, and review workflows without bypassing accepted queue gates.
- Social publishing operations that extend the existing Rust/Node provider
  contracts with preflight, missed-post recovery, metrics backfill, and
  operator-visible error state while keeping SaaS Maker as the control plane.
- Repos that strengthen content and media without replacing already-installed libraries.
- Repos that strengthen ui workflows without replacing already-installed libraries.
- Repos that strengthen ai agents without replacing already-installed libraries.
- Repos that strengthen repo intelligence without replacing already-installed libraries.
- Repos that strengthen ingestion and sync without replacing already-installed libraries.
- Repos that strengthen analytics and intelligence without replacing already-installed libraries.
- Repos that strengthen cloudflare and deploy without replacing already-installed libraries.
- Tools with concrete support for run, npm, reel, maker, remotion, render, saas, reels.
- Implementation repos, SDKs, CLIs, testing utilities, adapters, and focused libraries are higher value than generic awesome lists.

Avoid recommending:
- For the kids-story bet, avoid new automation stacks until the first three
  manual videos exist and pass a parent-trust review.
- Avoid app-marketing recommendations that skip format testing and jump straight
  to more render engines, schedulers, or auto-posting.
- Avoid copying AGPL social-publishing code such as Postiz into this repo;
  reimplement small workflow patterns locally when they fit the existing
  provider contracts.
- Do not recommend packages already listed under direct or development dependencies unless the task is migration research.
- Do not recommend broad framework replacements unless the project context explicitly calls for a rewrite.
- Downrank curated lists, archived repos, stale demos, and generic UI kits that do not map to the feature catalog.

## Evidence Read

Primary docs and handoff files:
- `AGENTS.md`
- `PROJECT_STATUS.md`
- `README.md`
- `docs/creator-mvp.md`
- `docs/creator-mvp-packs/README.md`
- `docs/growth-format-playbook.md`
- `docs/architecture.md`
- `docs/engine-pins.md`
- `docs/archive/2026-06-20-prd-product-proof-reels-phase1-shipped.md`
- `docs/submodules.md`
- `docs/upstreams.md`

Package manifests:
- `engines/openshorts/dashboard/package.json`
- `engines/openshorts/remotion/package.json`
- `engines/openshorts/render-service/package.json`
- `engines/reel-maker/package.json`
- `package.json`

Inventory notes:
- Files scanned: 1430
- This pass uses deterministic repo inventory plus local documentation/source-path evidence. It does not claim a full manual line-by-line review of every source file.

## Confidence

Confidence: **needs review**

Why:
- PROJECT_STATUS.md present
- README.md present
- package dependencies inventoried
- 20 test/quality files identified

Refresh command:

```bash
cd /Users/sarthak/Desktop/fleet/starboard
pnpm fleet:audit-recommendation-context
pnpm fleet:extract-projects
```
