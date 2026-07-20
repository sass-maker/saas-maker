## 1. Owner Decisions And Contracts

- [ ] 1.1 Record owner approval or revisions for the seven defaults in `design.md` Open Questions before changing product behavior
- [ ] 1.2 Add versioned performance receipt, rollup, span, downstream-operation, freshness, and query contracts under `internal/contracts/`
- [ ] 1.3 Extend `catalog/foundry.json` and its validator/generator with web/API performance surface declarations and no duplicate hand-edited registry
- [ ] 1.4 Add contract tests for invalid methods, unsafe URLs, missing provenance, unknown projects, high-cardinality labels, and prohibited sensitive fields

## 2. Durable Foundry Evidence API

- [ ] 2.1 Add an additive D1 migration for bounded performance spans, rollups, surface budgets, and cleanup metadata
- [ ] 2.2 Implement authenticated project-scoped performance receipt ingestion with idempotency, size limits, redaction validation, and source provenance
- [ ] 2.3 Implement private summary, trend, recent-span, top-route, slow-route, error-route, and trace-operation query endpoints
- [ ] 2.4 Implement bounded retention cleanup and ingestion-volume reporting without putting cleanup on the product request path
- [ ] 2.5 Regenerate OpenAPI artifacts and update CLI/SDK docs and examples for the new endpoints
- [ ] 2.6 Add API unit tests covering authorization, idempotency, aggregation, source separation, retention, and privacy rejection

## 3. Synthetic Web And API Measurement

- [ ] 3.1 Replace the legacy fleet performance URL registry with generated catalog performance surfaces
- [ ] 3.2 Add a bounded API probe runner that records cold/warm samples, status, timeout, DNS/connect/TLS/TTFB/total phases when available, and probe origin
- [ ] 3.3 Adapt PSI Swarm output to the performance receipt contract while retaining local diagnostic references
- [ ] 3.4 Add local fixture mode and deterministic runner tests for timeout, unavailable phases, partial failure, and safe-method enforcement
- [ ] 3.5 Add daily API, weekly web, and release-on-demand schedule definitions in an inert state pending designated-host activation approval

## 4. Runtime API And Query Visibility

- [ ] 4.1 Implement a dependency-free reference runtime timing adapter with route normalization, bounded sampling, asynchronous delivery, and failure isolation
- [ ] 4.2 Implement sanitized downstream-operation helpers for D1/SQL, external HTTP, KV, R2, AI, and queue operations using fingerprints and allowlisted labels
- [ ] 4.3 Add compatibility adapters for existing `api_call_timing` and `foundry_trace` evidence with explicit source semantics
- [ ] 4.4 Instrument SaaS Maker API as the canary and test telemetry overhead, cardinality bounds, error sampling, redaction, and product-request isolation
- [ ] 4.5 Generate a maintained-API rollout inventory showing instrumented, synthetic-only, unmeasured, and not-applicable surfaces
- [ ] 4.6 Prepare bounded per-project rollout patches or tracker items for every maintained API that requires runtime instrumentation

## 5. Cockpit Speed Workspace

- [ ] 5.1 Add authenticated `/fleet/speed` navigation and a dense coverage/freshness overview using the shared Foundry UI system
- [ ] 5.2 Add the fleet web/API table with percentile, count, error, revision, source, and regression columns
- [ ] 5.3 Add recent API requests plus top-volume, slowest-percentile, and highest-error route views with project/window/source filters
- [ ] 5.4 Add route detail with latency/throughput/error trends, cold/warm comparison, recent spans, and downstream-operation contribution summaries
- [ ] 5.5 Add web detail with Core Web Vitals distributions, comparable revisions, regressions, and safe PSI Swarm diagnostic links
- [ ] 5.6 Add explicit observation/alert/enforcement state and an owner confirmation flow for activating suggested budgets
- [ ] 5.7 Link configuration inventory and Speed, then retire the PostHog-only latency card only after functional parity tests pass

## 6. Validation And Controlled Rollout

- [ ] 6.1 Run contract, API, catalog, typecheck, lint, unit, and Cockpit component tests with no production credentials
- [ ] 6.2 Run local synthetic canaries and confirm no mutating/authenticated business endpoint is probed
- [ ] 6.3 Verify via browser that empty, stale, partial, fresh, failing, high-volume, and narrow-screen Speed states are scannable and accessible
- [ ] 6.4 Verify stored and returned fixtures contain no secrets, raw query values, payload bodies, user identity, or unbounded labels
- [ ] 6.5 Update `PROJECT_STATUS.md`, observability/performance runbooks, catalog-generated views, and the designated-host activation checklist
- [ ] 6.6 Open and merge the Foundry implementation PR only after exact-head CI is green; keep schedules disabled
- [ ] 6.7 After separate production and host approval, activate collection in observation-only mode and review 14 days of baselines with the owner before enabling alerts

