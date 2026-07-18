# Architecture

How SaaS Maker is structured and how its parts interact.

## System shape

- **Operator** (browser + `fnd` CLI) → Cockpit (`app.sassmaker.com`), API
  (`api.sassmaker.com`), showcase/docs (`sassmaker.com`, `docs.sassmaker.com`).
- **Hub-and-spoke**: fleet spokes push up to SaaS Maker via `/v1/*` and widgets.
  Spokes do not call each other directly. Reel-pipeline ⇄ marketing queue is the
  reference integration pattern.
- **Shared D1** `saasmaker-db` (Drizzle ORM): tasks, projects, marketing,
  events, workflows. Used by API, Cockpit, and Droid.
- **Auth bridge**: Cockpit signs in via better-auth (Google OAuth); the API
  worker resolves opaque Bearer session tokens against the shared D1 `session`
  table by raw SQL — it has no better-auth dependency, so the two services stay
  decoupled. CLI tokens use the `sm_` prefix.
- **R2** `saasmaker-feedback-images` for binary assets; **Workers AI** binding
  for API AI; Droid uses DeepSeek models; PostHog telemetry inlined in the API.

## Files

- [`symphony.md`](symphony.md) — Foundry Symphony orchestration layer: task
  tracker, agent dispatch, usage sampling, fleet failure importer.
- [`droid.md`](droid.md) — Droid sandbox runner quickstart, run request fields,
  output, reliability, and permission/audit model.
- [`droid-roadmap.md`](droid-roadmap.md) — what must be true before Droid is
  treated as a hands-off production employee.
- [`task-cloud-audit.md`](task-cloud-audit.md) — recommended execution "cloud"
  (local / GitHub Actions / Cloudflare Workers) per recurring task type.

## Subdirectories

- [`decisions/`](decisions/) — durable, dated design decisions and plans
  (ADR-style). Start there when investigating why a system has its current shape.
- [`research/`](research/) — research notes that informed decisions.
