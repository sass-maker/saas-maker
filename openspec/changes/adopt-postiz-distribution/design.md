## Context

Reel Pipeline was imported into the SaaS Maker monorepo as
`services/reel-pipeline`. It contains valuable generation and rendering code,
but it also owns direct YouTube and Instagram OAuth, scheduling, retries,
posting, and metric synchronization. Foundry separately owns campaign context,
two-stage approval, and the marketing queue. This creates overlapping state
machines and provider-specific maintenance.

Postiz already supplies channel connections, draft/schedule/now states,
provider validation, publishing workflows, and social analytics through a
public API. Its official self-hosted deployment is a stateful Docker stack using
PostgreSQL, Redis, Temporal, and persistent media storage. It is AGPL-3.0.

## Goals / Non-Goals

**Goals:**

- Make Postiz the sole scheduler and publisher for social channels.
- Separate generation/building from distribution.
- Keep Foundry as the source of product context, approvals, attribution, and
  normalized outcome evidence.
- Prevent duplicate publication across retries, host failover, and migration.
- Preserve an explicit owner gate before anything is scheduled or published.
- Make Postiz replaceable through a narrow provider-neutral boundary even
  though it is the selected implementation.

**Non-Goals:**

- Forking, embedding, or modifying the Postiz source tree.
- Using Postiz's AI generation as the Fleet's creative system.
- Exposing the Postiz UI as a second public Foundry dashboard.
- Moving product direction or feature implementation into Foundry automation.
- Activating accounts, production schedules, DNS, or secrets in the source-only
  implementation phase.

## Decisions

### 1. Postiz is an external service, not a monorepo package

Run an official Postiz container image pinned to a tested version and digest on
the designated operations machine. Keep its compose overlay and non-secret
configuration contract in Foundry, but keep the runtime checkout, credentials,
database, Redis, Temporal state, and uploads outside git. Prefer Cloudflare R2
for durable media once the deployment is activated.

This avoids copying AGPL code into SaaS Maker, keeps upstream upgrades possible,
and prevents Postiz's large application stack from becoming a Foundry build
dependency. Building a custom scheduler was rejected because that is the
duplication this change removes. Postiz Cloud remains a fallback, not the
default, because the designated host already exists and the owner is the only
user.

### 2. Three systems own three distinct records

- Foundry owns campaign intent, project attribution, content approval,
  distribution approval, and normalized measurement evidence.
- Content Factory owns generation attempts, quality evidence, immutable asset
  manifests, and render receipts.
- Postiz owns connected channel configuration, drafts, schedules, publication
  attempts, release IDs, and native social analytics.

Foundry stores Postiz identifiers and normalized receipts, not a second mutable
copy of Postiz's scheduling state. `catalog/foundry.json` remains the only
hand-edited product/deployment catalog.

### 3. Content Factory is the retained creative boundary

Move generation-only behavior toward `services/content-factory`. Existing Reel
Pipeline render engines remain adapters during migration. Each accepted input
produces a versioned artifact manifest containing source provenance, content
hash, asset locations, variants, quality result, and approval state. No Content
Factory module receives social provider credentials or calls Postiz directly.

A single large rewrite was rejected. The migration first introduces the
boundary and tests, then moves or removes one engine/path at a time while
preserving git history.

### 4. Foundry owns one server-side Postiz adapter

The adapter uses Postiz's public API to list integrations, create drafts or
schedules, list posts, change draft/schedule status, and read post/platform
analytics. The API key and base URL remain server-side. Cockpit never receives
them.

The adapter accepts provider-neutral distribution requests and translates them
to platform-specific Postiz settings. It batches compatible posts because the
Postiz create endpoint has an instance-wide hourly request limit. Transient
errors use bounded retry with jitter; validation and auth failures do not retry.

### 5. Idempotency is enforced before Postiz

Foundry persists a delivery mapping keyed by the immutable distribution request
ID plus content hash and integration ID. A retry returns the existing Postiz
post ID unless the prior attempt is explicitly terminal and the owner approves
a replacement. Host lease ownership and the mapping are checked before every
create call. This is necessary because duplicate prevention cannot depend on an
undocumented upstream idempotency contract.

### 6. Existing two-stage approval remains authoritative

Content acceptance allows generation. Distribution approval, given only after
a render receipt exists, allows creation of a Postiz draft or schedule. A draft
may be created for review, but promotion to scheduled/now still requires the
recorded approval. Postiz UI changes are reconciled back as evidence; they do
not silently manufacture Foundry approval.

### 7. Evidence synchronization is bounded polling

Use bounded polling initially because the documented public API supports post
listing and analytics while no required webhook contract is assumed. Poll only
known active/recent Postiz IDs, persist a cursor and freshness timestamp, and
emit `fresh`, `stale`, `failed`, or `unmeasured`. Store aggregate metrics and
provider receipts, not comments, DMs, access tokens, or unrelated account data.

### 8. Cockpit remains the operator surface

Cockpit shows Content Factory generation state, approvals, Postiz scheduling
state, release receipts, and normalized performance. The Postiz UI remains a
private operational escape hatch for account setup and provider-specific
troubleshooting.

## Risks / Trade-offs

- **Postiz is operationally heavy** → Pin versions, use the official compose
  topology, add health/backups, and keep activation on the designated machine.
- **AGPL obligations or upgrade friction** → Run upstream unmodified as a
  separate service; do not copy source or link it into proprietary packages.
- **Duplicate posts during retries or failover** → Enforce Foundry idempotency,
  host lease ownership, and explicit replacement approval.
- **Public API drift** → Contract-test against a pinned container and isolate all
  payload translation in one adapter.
- **Platform metrics differ** → Preserve provider/metric labels and normalize
  only stable aggregate concepts; show unknown rather than inventing parity.
- **Postiz outage blocks distribution** → Generation and approval continue;
  approved requests remain queued and no direct publisher fallback runs after
  final cutover.
- **Two UIs can diverge** → Cockpit is authoritative for approvals; Postiz is
  authoritative for provider execution and is private.

## Migration Plan

1. Add contracts, fixture-backed adapter tests, idempotency storage, and Cockpit
   read models with all production calls disabled.
2. Add a pinned Postiz host manifest and readiness doctor; do not commit secrets
   or activate services.
3. Run Postiz locally with fake/test integrations and prove draft creation,
   reconciliation, retries, and analytics normalization.
4. On explicit approval, install Postiz on the designated operations machine,
   configure backups/storage, connect one non-critical channel, and run in
   draft-only shadow mode.
5. Schedule and publish one approved canary; verify release ID and metrics round
   trip into Foundry.
6. Disable direct Reel Pipeline publishers and schedulers, then observe a
   rollback window with their credentials removed from active runtime.
7. Remove obsolete OAuth/posting/retry/metrics code and rename the retained
   generation boundary to Content Factory.

Rollback before step 6 routes no new work to Postiz and leaves existing Postiz
drafts cancelled manually. Rollback after step 6 requires explicit owner action;
the old publisher is not automatically re-enabled.

## Open Questions

- Choose the private operator hostname, if any, during host activation. A
  Tailscale-only URL is the default; no public `*.sassmaker.com` hostname is
  required.
- Select the first canary channel after account availability is inspected.
- Decide the retention window for Postiz database backups before activation.
