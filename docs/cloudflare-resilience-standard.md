# Cloudflare fleet resilience standard

This is the minimum operational contract for a fleet surface that runs on
Cloudflare Workers/Pages or uses GitHub Actions for scheduled work.

Run the read-only audit from the fleet root:

```bash
node fleet-ops/scripts/cloudflare-resilience-audit.mjs
```

The audit writes redacted evidence to `.symphony/cloudflare-resilience/` and
probes the canonical domains in `fleet-ops/config/projects.json`. It never
deploys, deletes, changes DNS, migrates data, changes secrets, or changes
Cloudflare account configuration.

## Runtime contract

Every cron, scheduled workflow, Queue consumer, Workflow, Durable Object alarm,
or AI-heavy background path must have:

1. A bounded input, batch, page size, or explicit hard limit.
2. A timeout shorter than the platform or runner maximum.
3. A retry policy with a terminal failure state; no infinite retry loop.
4. A stable idempotency/deduplication key for replay-safe writes.
5. Observable success/failure evidence with enough context to investigate.
6. Single-flight/concurrency control when overlapping runs can duplicate work.
7. A replay or recovery path for partial failure.

Use Queues or Workflows for durable asynchronous work. Do not turn a user HTTP
request into an unbounded fire-and-forget job; use `ctx.waitUntil()` only for
bounded post-response work and always handle the Promise.

## Deploy contract

Every production deploy path must have:

- a known source SHA and a clean, tested build;
- a bounded CI timeout;
- a post-deploy smoke check that uses `curl --fail` or an equivalent assertion;
- an explicit canonical URL or documented non-public artifact exception;
- a documented rollback target/runbook for Worker-backed surfaces.

Preview work must use Pages preview deployments or same-Worker version
previews. A workflow that creates a persistent `-preview` or `-pr-*` Worker must
also delete it on PR close; otherwise it is a blocking account-hygiene finding.

## Observability and cost

Workers should enable Workers Logs with an intentional sampling rate and use
structured, bounded logs. Review CPU, request, subrequest, error, and latency
shares during billing reviews. A sudden traffic increase is a reliability and
cost incident even when the homepage still returns 200.

## Exceptions

Exceptions belong in `fleet-ops/config/projects.json` or the relevant project
operations doc with an owner and reason. Expected API-root 404s, direct-upload
Pages projects deployed by Actions, personal surfaces, and artifact-only
Workers are valid exceptions when their live behavior and deployment source of
truth are documented.

## Predictive failure register

These are the failure modes most likely to become expensive or user-visible as
the fleet grows. The audit is a tripwire; it is not permission to apply a
fleet-wide traffic policy automatically.

| Failure mode | Early signal | Preventive control | Operator response |
| --- | --- | --- | --- |
| Crawler or abuse-driven CPU/cost spike | CPU, request, subrequest, or egress share rises without a matching product event | Keep hot paths cheap, cache safe reads, protect expensive endpoints deliberately per product, and alert on spend/CPU | Identify the route and caller pattern first; then choose a narrowly scoped WAF/rate-limit rule if evidence supports it |
| Queue retry storm or backlog | Queue age, retry count, failed batches, or Workflow retries climb | Bounded batches, finite retries, terminal failure state, idempotency key, and replay/DLQ path | Pause the producer if necessary, inspect the failed payload class, replay only after the cause is fixed |
| Overlapping cron or GitHub runs | Two active runs for one schedule, lock contention, or duplicate writes | Concurrency groups, leases, unique constraints, and single-flight guards | Stop overlap at the scheduler/lease layer; do not “fix” duplicates by deleting data |
| Provider/API slowness or outage | Fetch latency, timeout rate, 429/5xx rate, or provider spend rises | Per-call timeout, bounded backoff, circuit/fallback behavior, and a durable retry state | Fail closed for writes, preserve the job for replay, and surface degraded mode |
| Unbounded fan-out or subrequest growth | Subrequests per invocation, `Promise.all` width, or per-user work grows with input size | Page/size caps, concurrency limits, chunking, and a hard per-invocation budget | Reduce the work window and move durable work to Queue/Workflow |
| Build/deploy drift | Frozen-lockfile errors, rising build time, missing smoke result, or stale source SHA | Lockfile enforcement, runner timeout, canonical smoke, deployment evidence, and rollback target | Block promotion; repair the source-of-truth branch before rerunning |
| Preview/resource sprawl | New Worker names with PR/preview markers or unexplained resource count growth | Pages previews or same-Worker versions; explicit teardown for temporary resources | Inventory first, then remove only resources with an owner decision |
| Blind failure due to missing telemetry | A Worker has no Logs/trace evidence or an incident cannot be correlated to a request/job | Intentional Workers Logs sampling, bounded structured logs, and job/run identifiers | Add observability before tuning traffic controls or retry behavior |

The current fleet has evidence of the bounded-job, deduplication, smoke-check,
and preview controls above. It deliberately does not have a blanket rate-limit
policy: that remains a product-by-product decision based on observed traffic,
authentication boundaries, and endpoint cost.

## Current baseline — 2026-07-18

- Cloudflare authentication: Wrangler OAuth for the intended account.
- Live Pages inventory: 18 projects.
- Live Workers inventory in the manifest: 25.
- Per-Worker deployment queries: 17/17 actual Worker names returned deployment
  history; the Knowledge Base Pages name and `RAG_SERVICE` service binding were
  intentionally not treated as standalone Workers.
- Canonical domains probed by the resilience audit: 29; all returned 200.
- Blocking resilience findings: 0.
- Medium deploy-gate findings fixed locally: Chess, Drank, Pace, PostTrainLLM.
- Remaining low-priority findings: five observability blocks on Worker configs;
  scheduled-workflow timeout debt was fixed locally in this pass. These are
  tracked by the audit output and are not silently treated as production
  failures.
- Known workflow/data failures are separate from live-domain resilience:
  SaaS Maker Docs had a frozen-lockfile mismatch on a dirty docs branch; the
  root lockfile now passes frozen install and the 85-page Blume build locally,
  but GitHub has not been rerun yet. Protein Index has an official-brand source
  accounting failure in its publish path; and the historical Chess deploy
  failure is now followed by successful CI and a live 200 surface.

The baseline is evidence, not a promise that external outages are impossible.
The goal is that failures become bounded, visible, replayable, and reversible.
