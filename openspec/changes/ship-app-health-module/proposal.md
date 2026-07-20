## Why

The current fleet-speed feature can store and display endpoint performance, but a product developer cannot yet install one supported SDK, provide only a SaaS Maker project key, and immediately see their Node.js or Go endpoints. App Health turns that existing evidence system into the deliberately small V0 promised by the product: key-only instrumentation, automatic endpoint discovery, and a focused private dashboard.

## What Changes

- Consolidate App Health into SaaS Maker rather than operating a separate product backend or registry.
- Extend the authenticated performance-ingest contract so the project identity is derived from the API key when SDK payloads omit it.
- Add dependency-free Node.js instrumentation to `@saas-maker/sdk`, including Express middleware and bounded fail-open delivery.
- Add a dependency-free public Go module for `net/http` middleware and bounded fail-open delivery.
- Add a focused Cockpit App Health workspace that lists discovered routes with bounded sample activity, error rate, p50/p95 latency, health, and last-seen evidence.
- Add copy-paste Node.js and Go installation guides, agent-readable discovery surfaces, and checked-in product screenshots.
- Keep the existing provider-neutral performance evidence tables and `/fleet/speed` workspace as the canonical store and advanced operations view; no second App Health database or project registry is introduced.
- Keep production D1 migration, npm publication, and Cloudflare deployment as separately reported release actions. The owner has authorized Cloudflare deployment in this request, but has not implicitly authorized npm publication or applying unrelated pending migrations.

## Capabilities

### New Capabilities

- `app-health-sdk-onboarding`: Key-only Node.js and Go instrumentation, privacy rules, fail-open delivery, and reproducible installation guidance.
- `app-health-cockpit`: Focused private endpoint discovery and health visualization backed by canonical performance evidence.
- `app-health-agent-docs`: Non-JavaScript documentation and machine-readable installation metadata for coding agents.
- `app-health-key-scoped-ingest`: Project-scoped span ingestion that derives project identity from the authenticated API key when the SDK omits redundant identity fields.

### Modified Capabilities

None.

## Impact

- Affects `packages/blocks/sdk`, a new Go module under `packages/`, the Hono performance route, internal performance contracts, Cockpit navigation/components, public Blume docs, agent-indexing surfaces, OpenAPI artifacts, tests, and `PROJECT_STATUS.md`.
- Reuses D1 migration `0023_performance_evidence.sql`; this change adds no new production database or production dependency.
- The public Node package requires a normal semver release before the documented registry install exposes App Health. The Go module becomes installable from the public repository after the source is pushed.
- Production activation remains fail-closed until the required D1 migration and exact-head deploy checks are explicitly satisfied.
