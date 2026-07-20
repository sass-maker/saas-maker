## Context

SaaS Maker already has the canonical provider-neutral performance tables, authenticated span ingestion, private queries, and the advanced `/fleet/speed` workspace. The separate App Health prototype proved the Node/Express and Go `net/http` instrumentation behavior but used unpublished package identities and a local-only backend. This change consolidates the useful SDK behavior and focused UI into SaaS Maker without creating a parallel store.

The V0 user is a developer or coding agent adding one key to a Node.js or Go API. The request path must stay independent of telemetry availability, and the collected record must remain a small endpoint summary rather than an application trace.

## Goals / Non-Goals

**Goals:**

- Make the minimal installation require only a SaaS Maker project API key.
- Automatically capture normalized framework route templates, status class, duration, timestamp, and optional release.
- Show discovered endpoints with useful performance and error summaries in a polished private Cockpit workspace.
- Provide truthful, copy-paste installation docs for humans and coding agents.
- Reuse the existing performance evidence API, D1 tables, auth, queries, and advanced Speed workspace.

**Non-Goals:**

- Request/response bodies, headers, cookies, query values, path parameter values, user identity, logs, stack traces, or replay.
- Distributed tracing, database query collection, alerting, deploy blocking, or automatic endpoint probing.
- A second project registry, App Health Worker, D1 database, or Cockpit authentication system.
- Publishing the npm package or applying production migrations without the distinct release authorization those actions require.

## Decisions

### 1. App Health is a SaaS Maker module over canonical performance evidence

The SDKs submit the existing normalized span shape to `/v1/performance/spans`; the focused Cockpit workspace reads the existing private summary/routes/recent APIs. `/fleet/speed` remains the advanced provider-neutral operations view.

Alternative considered: port the prototype Worker and event store unchanged. Rejected because it duplicates auth, D1, retention, route aggregation, and dashboard data already owned by SaaS Maker.

### 2. The API key supplies project identity

The ingest handler authenticates the key first, then fills a missing `project_id` with that project's canonical slug before validation. A supplied mismatched value remains forbidden. The SDK therefore needs only a key; callers cannot write evidence across project boundaries.

Alternative considered: require both key and project slug. Rejected because the slug is redundant authenticated context and violates the promised one-key setup.

### 3. SDKs are bounded, asynchronous, and dependency-free

Node and Go clients use a bounded in-memory queue, fixed maximum batch size, short request timeouts, bounded retry attempts, and fail-open drops under pressure. Middleware records after a response completes and never awaits telemetry on the request path. Go uses only the standard library; Node uses built-in `fetch` and structural Express-compatible types, so no production dependency is added.

Alternative considered: send every event inline. Rejected because SaaS Maker availability must never affect application latency or correctness.

### 4. Route templates are required; unsafe concrete paths are dropped

Express middleware uses `baseUrl + route.path`; Go uses `Request.Pattern` where available and accepts an optional router resolver. Non-Express callers may record an explicit trusted template. When no valid framework template or resolver result exists, the SDK drops the summary instead of falling back to a concrete request path. Raw query strings are never inspected or sent.

### 5. The focused UI derives health from evidence, not catalog declarations

App Health lists routes discovered in authenticated spans. For the selected time window it shows observed sample count, error rate, p50/p95, last seen, and a deterministic state: insufficient data, healthy, degraded, or unhealthy. Ingest caps and truncated query windows remain visible so sample counts are never presented as total traffic. Empty and unavailable states tell the operator how to install or repair the SDK; sample data is never substituted in production.

### 6. Documentation has human and agent surfaces

Canonical Markdown pages under `docs/sdk/` are rendered by Blume. A public App Health manifest provides exact package/module names, minimum runtime versions, environment variables, ingest URL, supported middleware, verification steps, and privacy limits. `llms.txt`, `/api/ai`, and Markdown-readable entrypoints link to that manifest without requiring dashboard JavaScript.

### 7. Checked-in readiness and production activation remain separate

Source changes can be committed after local checks. Cloudflare deploy follows the fleet deploy guard on clean, synced, exact-head-green `main`. Existing pending D1 migrations are reported and applied only with explicit migration approval. The Node package is packed and consumer-tested locally; registry publication is a separate explicit release.

## Risks / Trade-offs

- [Every-request spans can create storage volume] -> Existing per-route caps, bounded SDK queues, seven-day span retention, and server validation remain active.
- [Strict template requirements can omit unmatched routes] -> Document middleware placement and router-specific resolvers; missing evidence is safer than leaking identifiers or creating unbounded cardinality.
- [SDK delivery failures hide monitoring gaps] -> Expose local diagnostics and show stale/unavailable evidence clearly in Cockpit; never fail the product request.
- [The npm docs can outrun package publication] -> Do not deploy registry install claims as shipped until the exact package version exists; validate the packed tarball first and report publication as a release boundary.
- [Pending production migrations span other features] -> Inspect the ordered migration set and request explicit approval instead of selectively bypassing Wrangler's migration ledger.

## Migration Plan

1. Land and validate key-scoped ingest, SDKs, Cockpit, docs, and screenshots on `main`.
2. Confirm exact-head CI and pass the SaaS Maker deploy guard.
3. With explicit migration approval, apply the ordered pending D1 migrations and verify the ledger.
4. With explicit package-release approval, publish the verified Node semver and tag the Go module.
5. Deploy the API, Cockpit, and package-docs surfaces together, then run production smoke and a project-scoped canary.
6. Roll back by deploying the prior Worker versions and removing the App Health navigation entry; SDK delivery remains fail-open and does not require rollback for application correctness.

## Open Questions

- Production D1 migration approval is not yet granted; four ordered migrations are currently pending (`0022` through `0025`), including unrelated migration `0025_foundry_operational_tables.sql`.
- npm publication approval is not yet granted. The source and packed artifact can be completed without publishing.
