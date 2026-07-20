---
title: Fleet performance observability
description: Canonical web and API speed evidence, privacy, retention, and activation contract for Foundry.
---

## Purpose

Foundry performance observability answers four separate questions without
pretending they are the same measurement:

1. Is each public web surface fast from a controlled external probe?
2. Are declared public API health and read-only endpoints fast and available?
3. Which normalized API route templates are busiest, slowest, or failing in
   sampled runtime traffic?
4. Which sanitized downstream operation fingerprints account for time inside a
   sampled request?

The private Cockpit Speed workspace is the operator view. The canonical
declarations live in `catalog/foundry.json`; the generated runner input and
coverage inventory live in `catalog/generated/performance-surfaces.json`.
Neither PostHog nor Cloudflare is the source of truth.

## Evidence lanes

| Lane | Source | What it proves | What it does not prove |
| --- | --- | --- | --- |
| Web synthetic | PSI Swarm repeated Lighthouse runs | Controlled Core Web Vitals distributions and diagnostics | Real-user device/network distribution |
| API synthetic | Bounded Foundry probe runner | Anonymous endpoint status, cold/warm client latency, and available network phases | Authenticated business-flow latency or platform cold starts |
| Browser RUM | Existing Resource Timing/PostHog adapters | User-perceived browser-to-API latency | Server-only work or exact HTTP status in Resource Timing |
| Server runtime | Foundry runtime adapter | Sampled normalized route latency, status class, and trace correlation | Complete traffic volume unless sampling is accounted for |
| Downstream operations | Runtime helper fingerprints | Time attributed to allowlisted D1/SQL/KV/R2/HTTP/AI/queue operations | Raw query text, values, or payloads |
| Provider enrichment | PostHog, Cloudflare, CrUX, future OTel adapters | Provider-specific context | Canonical coverage or health when provider evidence is absent |

Sources remain separate in storage and charts. Percentiles from unlike sources
or observation windows are never merged into one series.

## Approved defaults

The owner approved these defaults on 2026-07-20:

- Foundry D1 stores provider-neutral receipts.
- Synthetic probes are anonymous `GET` or `HEAD` checks against catalog-declared
  health/read-only endpoints only.
- API checks are designed for daily execution; PSI Swarm web checks are weekly;
  release checks are operator-triggered.
- Sanitized sampled spans retain seven days. Aggregate rollups retain thirteen
  months.
- Runtime adapters sample ten percent of successful requests and all failed or
  slow requests, subject to bounded delivery and ingestion caps.
- Collection starts with fourteen observation-only days. No result blocks a
  deploy, and no budget alerts until the owner approves that surface's budget.
- Downstream visibility stores fingerprints and allowlisted operation labels,
  never raw query text or values.

`performancePolicy.synthetic.schedulesActive` is fixed to `false` in the
canonical catalog. Changing it, installing a scheduler, applying the D1
migration, or deploying the implementation remains a separate production
approval.

## Privacy boundary

Performance ingestion rejects:

- authorization headers, cookies, tokens, credentials, and secret-like fields;
- URL query strings and fragments;
- request or response bodies and arbitrary headers;
- SQL text, bind values, raw database queries, and user content;
- IP addresses, email addresses, and stable user identifiers;
- unnormalized high-cardinality route labels and unbounded operation labels.

A recent request row contains only project/surface identity, environment,
source, revision when known, normalized method and route template, status class,
duration, sample basis, timestamp, and generated trace identifier. A downstream
row contains operation kind, allowlisted label, stable fingerprint, duration,
success state, and parent trace identifier.

## Coverage and freshness

Every maintained product appears in the generated inventory, including products
with no measurable surface. The allowed states are explicit:

- `fresh`: successful evidence is within the surface freshness window;
- `stale`: prior evidence exists but is too old;
- `unmeasured`: the catalog expects coverage but no trustworthy receipt exists;
- `failing`: recent evidence failed the declared status contract;
- `not-applicable`: that evidence lane does not apply to the runtime.

Configured source code is not live proof. Missing evidence must never render as
healthy or as zero latency.

## Synthetic operation

The API runner consumes only the generated catalog projection. It rejects
mutating methods, query strings, private/local destinations, unsafe redirects,
auth headers, unbounded concurrency, excessive sample counts, and oversized
responses. Fixture mode is deterministic and network-free.

The approved daily profile is five cold-client and fifteen warm-client samples
per API surface. The approved weekly PSI profile is five desktop and five mobile
runs per web surface. DNS, connect, TLS, TTFB, and total timing are recorded when
the runtime exposes them; unavailable phases stay explicitly unavailable.

The checked-in schedule definitions are intent only. They remain disabled until
the designated operations host has a shared lease, an approved role file, a
reviewed rendered schedule, and explicit activation approval.

## Runtime rollout

SaaS Maker is the canary. Other maintained API/Worker projects remain
`synthetic-only` or `unmeasured` until their bounded adapter is reviewed and
merged in that product. Adapter delivery must be asynchronous (`waitUntil` on
Workers), best-effort, and incapable of failing the product request.

The rollout inventory is generated rather than maintained as a second list. A
project moves to `instrumented` only when source configuration and fresh
delivery evidence both exist.

`catalog/generated/performance-rollout-inventory.json` is also the bounded
rollout queue. Every maintained API/runtime has one generated `rolloutAction`:
`instrument-runtime-adapter`, `verify-fresh-delivery`, or `none`. Product agents
should close that action in the canonical catalog/source evidence rather than
creating a separate fleet spreadsheet.

## Retention and cleanup

Cleanup is an explicit bounded operation outside product request handling. Each
run records cutoffs, bounded deletion counts, and completion evidence. Operators
can inspect ingestion volume before changing sampling. The retention policy is
part of the versioned contract; it is not inferred from database age.

## Validation and activation sequence

1. Validate the catalog and generated projections.
2. Run the deterministic API runner and adapter tests with no credentials.
3. Run API tests, typecheck, lint, docs checks, and Cockpit build.
4. Inspect Speed in empty, stale, partial, failing, populated, and narrow-screen
   states.
5. Merge only after exact-head CI is green, with schedules disabled.
6. Separately approve and apply the D1 migration and deploy API/Cockpit code.
7. Separately promote the designated host and install schedules.
8. Review fourteen days of evidence before approving alert budgets.

Rollback is additive: disable adapters and schedules, retain readable evidence,
and keep existing provider analytics untouched.
