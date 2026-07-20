## Why

The imported Reel Pipeline currently combines creative generation, rendering,
approval, scheduling, social OAuth, publishing, retries, and metrics. That
duplicates a mature scheduler and makes the Foundry responsible for too many
provider-specific failure modes. Postiz should become the sole distribution
engine while Foundry keeps product context, approvals, measurement, and
feedback understanding, and a separate Content Factory owns asset generation.

## What Changes

- Introduce a provider-neutral Content Factory handoff for approved briefs,
  generated variants, rendered assets, quality evidence, and immutable artifact
  receipts.
- Integrate a pinned, independently deployed Postiz instance through its public
  API for channel discovery, drafts, scheduling, publishing, and social metrics.
- Keep Postiz outside the SaaS Maker source tree and deployment artifact. Its
  AGPL service runs unmodified as a separately operated dependency; Foundry
  contains only its own adapter and contracts.
- Preserve the two-stage owner gate: content approval remains separate from
  distribution approval. No generated asset can become a Postiz schedule
  without explicit distribution approval.
- Normalize Postiz post IDs, channel IDs, release state, failures, and analytics
  into Foundry evidence so marketing outcomes feed the post-ship learning loop.
- **BREAKING:** retire the Reel Pipeline YouTube/Instagram scheduler, OAuth,
  posting, retry, and metrics paths after Postiz parity is verified. Reel code
  retained for generation must not publish directly.
- Rename and narrow the retained generation surface toward Content Factory;
  keep existing render engines as adapters until each is either proven useful
  or removed.
- Keep production deployment, account connection, DNS, secret setup, and final
  publisher cutover behind explicit owner approval and rollback evidence.

## Capabilities

### New Capabilities

- `content-factory-handoff`: Versioned contracts and state transitions for
  brief intake, generation, quality review, approval, and artifact handoff.
- `postiz-distribution-adapter`: One idempotent Foundry adapter for Postiz
  integrations, drafts, schedules, publishing state, and provider errors.
- `distribution-evidence-sync`: Bounded synchronization of Postiz release IDs
  and analytics into Foundry's measurement and feedback evidence.

### Modified Capabilities

None. The repository has no established main specs; existing marketing behavior
is captured by code and archived changes and will be superseded through the new
capabilities above.

## Impact

- SaaS Maker Cockpit marketing/distribution UI and API contracts.
- `services/reel-pipeline`, which will be separated into generation-only code
  plus transitional compatibility adapters.
- The operations host, which will run the pinned Postiz deployment and the
  bounded evidence synchronizer.
- Foundry catalog, observability inventory, deployment runbooks, and host
  readiness checks.
- External dependency: self-hosted Postiz with PostgreSQL, Redis, Temporal, and
  persistent object storage. Credentials and provider OAuth remain
  machine-local and are never committed.
