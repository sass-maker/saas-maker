## Why

Foundry cannot currently answer a basic fleet question from one place: which web surfaces and APIs are fast, slow, regressing, unmeasured, or failing right now. PSI Swarm has strong local web measurements and PostHog contains partial API telemetry, but their contracts, event names, freshness, and dashboard coverage do not line up.

## What Changes

- Establish a provider-neutral performance evidence contract for repeated web and API measurements, including percentile distributions, sample counts, source, environment, revision, and freshness.
- Add safe synthetic API probes for declared health and read-only endpoints, with separate cold and warm results and DNS, connect, TLS, TTFB, and total latency where available.
- Normalize real API request telemetry so Cockpit can show recent requests, busiest routes, slowest routes, errors, and latency percentiles without depending on one analytics provider.
- Add sanitized downstream-operation visibility using route templates and query fingerprints only; never collect raw query parameters, request or response bodies, SQL bind values, authorization material, or user content.
- Integrate PSI Swarm's repeated Lighthouse results as the canonical synthetic web lane instead of creating a second web performance runner.
- Add a private Cockpit Speed surface for fleet coverage, freshness, web and API trends, regressions, recent activity, and source provenance.
- Begin in observation-only mode. No performance result blocks deployment until enough baseline evidence exists and the owner explicitly approves budgets.

## Capabilities

### New Capabilities

- `performance-evidence-contract`: Source-neutral web and API measurement receipts, aggregation, freshness, and retention semantics.
- `api-request-observability`: Sanitized recent-request, top-call, route-latency, error, and downstream-query-fingerprint telemetry.
- `fleet-speed-cockpit`: Private fleet speed coverage, trend, regression, and drill-down views in Cockpit.

### Modified Capabilities

None. This repository has no existing root OpenSpec capability contracts.

## Impact

- Affects `catalog/foundry.json`, `ops/`, `tools/psi-swarm/`, the Hono API, internal contracts, Cockpit, generated OpenAPI/CLI documentation, tests, and operations runbooks.
- Reuses existing PostHog and Cloudflare data only as optional enrichments; synthetic evidence remains available when either provider is absent.
- Requires a small durable evidence store and authenticated spoke-to-Foundry submission path, but no production dependency or deployment is authorized by this proposal.
- Raw sensitive request/query data is explicitly out of scope.
