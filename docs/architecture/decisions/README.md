# Architecture Decisions

Durable, dated design decisions and plans (ADR-style). These record **why** a
system has its current shape. Active and deferred execution work belongs in
Symphony tasks; this directory is for historical or durable design artifacts
only.

## Index

### 2026-02 — Module designs

- [`2026-02-26-feedback-module-design.md`](2026-02-26-feedback-module-design.md)
- [`2026-02-27-vector-memory-service-design.md`](2026-02-27-vector-memory-service-design.md) — superseded by the knowledge/RAG removal (see [`../../knowledge/failed-approaches/`](../../knowledge/failed-approaches/)).
- [`2026-03-01-sdk-cli-docs-design.md`](2026-03-01-sdk-cli-docs-design.md)
- [`2026-03-07-roadmap-kanban-design.md`](2026-03-07-roadmap-kanban-design.md)

### 2026-04 — Operational layer

- [`2026-04-25-foundry-operational-layer.md`](2026-04-25-foundry-operational-layer.md)
- [`2026-04-26-quality-gates.md`](../../development/quality-gates.md) — lives in `development/` because it describes an active workflow.

### 2026-05 — Droid and Symphony

- [`2026-05-02-dynamic-workers-symphony.md`](2026-05-02-dynamic-workers-symphony.md)
- [`2026-05-11-foundry-droid-sandbox-runner.md`](2026-05-11-foundry-droid-sandbox-runner.md)
- [`2026-05-16-codevetter-integration-eval.md`](2026-05-16-codevetter-integration-eval.md)

### 2026-06 — Events hub, hub-and-spoke, superseded plans

- [`2026-06-04-ai-feedback-digest-module.md`](2026-06-04-ai-feedback-digest-module.md) — shelved; see [`../../knowledge/failed-approaches/`](../../knowledge/failed-approaches/).
- [`2026-06-04-magic-form-block-design.md`](2026-06-04-magic-form-block-design.md) — shelved; see [`../../knowledge/failed-approaches/`](../../knowledge/failed-approaches/).
- [`2026-06-19-fleet-events-hub-spec.md`](2026-06-19-fleet-events-hub-spec.md)
- [`2026-06-19-fleet-hub-and-spoke-eval.md`](2026-06-19-fleet-hub-and-spoke-eval.md)
- [`2026-06-20-prd-long-term-deferred-program.md`](2026-06-20-prd-long-term-deferred-program.md) — deferred program (Phases 0, 2–4).
- [`2026-06-20-tooling-plan-superseded.md`](2026-06-20-tooling-plan-superseded.md) — superseded; see [`../../knowledge/failed-approaches/`](../../knowledge/failed-approaches/).

## Conventions

- File names are `<date>-<topic>.md`.
- Record the date, the decision, the alternatives considered, and the
  consequences. Link to the code that implements it.
- When a decision is superseded, do not delete the file — add a "Superseded"
  section pointing to the replacement and cross-link from
  [`../../knowledge/failed-approaches/`](../../knowledge/failed-approaches/).
