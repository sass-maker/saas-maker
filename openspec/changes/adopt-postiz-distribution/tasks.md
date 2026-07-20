## 1. Contracts and boundaries

- [x] 1.1 Add versioned Content Factory brief, artifact-manifest, quality, and approval contracts with fixture-backed validation tests.
- [x] 1.2 Add provider-neutral distribution request, delivery mapping, provider receipt, and analytics evidence contracts.
- [x] 1.3 Add catalog declarations for Content Factory, the external Postiz service, privacy allowlists, ownership, and evidence freshness.
- [x] 1.4 Add architecture tests proving Content Factory imports no social publisher or provider credential modules.

## 2. Postiz adapter

- [x] 2.1 Implement a server-only Postiz client for health, integrations, post creation/listing/status, and post/platform analytics.
- [x] 2.2 Implement platform payload translation and fixture tests for the initial Instagram Reels and YouTube Shorts formats.
- [x] 2.3 Implement classified errors, timeouts, bounded retries, redaction, and instance-rate-budget handling.
- [x] 2.4 Add an inert fake-Postiz integration harness that proves draft, schedule, list, status, and analytics flows without credentials or external writes.

## 3. Idempotency and approval

- [x] 3.1 Add the delivery-mapping persistence migration and repository keyed by distribution request, content hash, and integration.
- [x] 3.2 Enforce content approval, verified artifact receipt, distribution approval, host lease, and delivery mapping before every Postiz create call.
- [x] 3.3 Implement ambiguous-result reconciliation and explicit replacement approval.
- [ ] 3.4 Extend the Cockpit distribution view to show generation, approval, Postiz draft/schedule/release, retry, and evidence freshness states.

## 4. Content Factory separation

- [x] 4.1 Inventory Reel Pipeline modules as generation, distribution, mixed, or obsolete and lock the inventory with a static test.
- [ ] 4.2 Establish `services/content-factory` with the generation-only contract and migrate the canonical render/package entrypoints while preserving history.
- [ ] 4.3 Route existing render engines through Content Factory manifests and verify current local generation smoke cases.
- [x] 4.4 Add fail-closed compatibility shims for direct Reel scheduling, posting, OAuth, and metrics commands; keep them disabled until final deletion.

## 5. Evidence and feedback loop

- [x] 5.1 Implement bounded Postiz post and analytics synchronization with cursor, freshness, and allowlisted persistence.
- [x] 5.2 Link every normalized receipt to project, campaign, brief, artifact, integration, and experiment identifiers.
- [ ] 5.3 Add Cockpit marketing outcome views for platform metrics, freshness, failures, and evidence-backed recommendations without automatic product-task creation.
- [ ] 5.4 Add synthetic/fake evidence tests proving unavailable Postiz state renders stale or unmeasured rather than green.

## 6. Host readiness

- [x] 6.1 Add a pinned official Postiz image/digest manifest and non-secret compose overlay for Postiz, PostgreSQL, Redis, Temporal, and persistent storage.
- [x] 6.2 Extend the Foundry host doctor for resources, persistent paths, backups, health endpoints, API compatibility, and private-network reachability.
- [x] 6.3 Add backup/restore and upgrade rehearsal runbooks; verify them against disposable local state.
- [x] 6.4 Add inert schedules for evidence synchronization and queued distribution; do not install or activate them.

## 7. Verification and owner-gated cutover

- [ ] 7.1 Run unit, integration, typecheck, lint, build, catalog, host, and fake-Postiz acceptance checks.
- [ ] 7.2 Obtain owner approval for host identity, private hostname, backup retention, initial channel, credentials, migration, and production activation.
- [ ] 7.3 Install the pinned Postiz stack on the designated host and verify health, persistence, backup, private access, and rollback without exposing secrets.
- [ ] 7.4 Connect one non-critical channel and complete draft-only shadow parity with Foundry.
- [ ] 7.5 Publish one separately approved canary and verify release plus analytics evidence round-trips into Cockpit.
- [ ] 7.6 Disable all direct Reel publisher/scheduler runtime paths, verify no duplicate execution, and observe the rollback window.
- [ ] 7.7 Remove obsolete direct OAuth, posting, retry, and metrics code; archive this OpenSpec change and update `PROJECT_STATUS.md`.
