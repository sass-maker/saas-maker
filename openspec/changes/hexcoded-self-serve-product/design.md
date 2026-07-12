# Design — HexCoded self-serve product

## Architecture boundary

Keep renderer engines behind the existing `VideoBrief` adapter contract and
keep Rust as the long-running render/post orchestrator. Add a product service
layer in front of those paths for authentication, tenancy, commercial state,
and durable job submission.

```text
Customer app
    |
    v
Authenticated product API
    |-- workspace + acceptance records
    |-- credit ledger + Dodo event inbox
    |-- actor/licence/provenance records
    |
    v
Durable render queue -> Rust orchestrator -> existing renderer adapters
    |                                      -> review/quality gate
    v
Tenant-scoped R2 artifact -> optional authorised social publisher
```

SaaS Maker remains the system of record for fleet marketing ideas and their
approval/posting state. Customer accounts, billing, biometric assets, and actor
earnings must not be stored in SaaS Maker notes or local JSON files.

## Domain model

Minimum durable records:

- `User`, `Workspace`, `WorkspaceMember`, `ExternalIdentity`
- `LegalAcceptance` with document, version/hash, subject, timestamp, and source
- `Campaign`, `VideoBrief`, `RenderJob`, `RenderAttempt`, `Artifact`
- `CreditAccount`, append-only `CreditEntry`, `Purchase`, `BillingEvent`
- `AssetProvenance`, `OutputLicence`, `DisclosureRecord`
- `Actor`, `ActorConsent`, `Twin`, `TwinAsset`, `ActorLicenceSnapshot`
- `ActorUse`, `EarningEntry`, `PayoutAccount`, `Payout`
- `SocialConnection`, `PublishJob`, `AuditEvent`

Identifiers exposed externally must be opaque. Every customer-owned record
must carry `workspaceId`; every actor use must carry `actorId`, `twinId`, and
the immutable licence/consent snapshot used for that generation.

## Authentication and tenancy

- Integrate one supported identity provider behind an internal auth adapter;
  do not spread provider-specific claims through render code.
- Authorise every read/write using workspace membership and role.
- Replace wildcard CORS with an explicit customer-app origin allowlist.
- Serve private artifacts through short-lived signed URLs or an authorised
  delivery endpoint; public URLs are created only for an explicitly approved
  publishing job and follow a documented expiry/revocation policy.
- Store service-to-service credentials outside application records and logs.

## URL-to-ad workflow

1. Customer submits a product URL plus audience, goal, claims, CTA, actor or
   non-actor treatment, and target channel.
2. Intake captures permitted product evidence and produces a draft brief.
3. The customer reviews claims, script, source assets, disclosure, and expected
   credit cost before accepting the generation.
4. A render job is created only from an accepted brief and an authorised credit
   hold.
5. Existing renderer adapters execute the job. Quality gates determine
   `ready`, `needs_review`, or `failed`; they never publish automatically.
6. Customer accepts the output before download or social publishing.

The initial launch supports non-actor stock/product-proof formats. Actor
selection remains feature-gated until Phase 2 is complete.

## Credit and billing semantics

- Treat the credit ledger as append-only double-entry-style events rather than
  a mutable balance field.
- Authorise/hold the quoted cost before enqueueing a render.
- Capture the hold once when a usable output reaches the defined successful
  state; release it on terminal technical failure.
- Require idempotency keys for render submission, Dodo webhooks, captures,
  releases, refunds, and chargeback adjustments.
- Reconcile purchase and refund events from a persisted webhook inbox; verify
  signatures before processing.
- Keep plan expiry, top-up expiry, allocation order, cancellation, refunds, and
  chargeback behavior explicit and testable.

## Actor lifecycle and licensing

- Actor onboarding is a separate role and workflow from brand accounts.
- Capture Actor Licence acceptance before uploading or processing biometric
  source material. Verification and twin creation are separately auditable
  stages.
- `Twin.status` supports at least `draft`, `verifying`, `active`, `paused`,
  `withdrawn`, and `rejected`. Only `active` twins can be newly cast.
- At generation time, snapshot the consent and licence terms into the
  `ActorUse`; later withdrawals stop new jobs but do not rewrite delivered-use
  history.
- Delivered outputs retain their licence proof without requiring retention of
  reusable master face/voice recordings. Master retention follows a separate,
  purpose-bound schedule.
- Earnings are created once per chargeable successful actor use, adjusted by
  explicit reversal entries, and never silently mutated.

## Provenance and disclosure

For every output record:

- customer-supplied inputs and claimed permissions;
- renderer/model/provider and relevant version;
- source footage, music, font, voice, and actor licence references;
- generation and edit timestamps;
- required AI/synthetic-content disclosure decision;
- exported metadata/label status;
- review and publication approvals.

The service must be capable of embedding or attaching required machine-readable
synthetic-content metadata. It must not assume that shifting all disclosure
responsibility to the customer is sufficient.

## Durable execution

- Persist state transitions before dispatching work.
- Lease jobs to workers with heartbeat/expiry and bounded retries.
- Make render completion, artifact publication, credit capture, and posting
  independently idempotent.
- Use an outbox/inbox boundary for external callbacks and SaaS Maker patches.
- A failed posting job must not convert an accepted render into a posted state.
- Preserve the existing accepted-item, scheduled-time, and explicit-confirm
  posting gates.

## Rollout

1. Introduce workspace-aware records and auth around a non-production shadow
   path while current internal flows remain available.
2. Migrate brand-only URL-to-ad renders and artifact access.
3. Enable billing in test mode; run duplicate-webhook and failed-render drills.
4. Prove one target-host brand flow, then enable a limited brand beta.
5. Build actor onboarding and run internal/sandbox actors only.
6. Enable real-actor casting after consent, licence, earnings, deletion, misuse,
   and payout acceptance tests pass.

No phase is enabled publicly merely because its code is merged.

## Verification strategy

- Unit tests for role checks, state transitions, credit invariants, licence
  snapshots, retention decisions, and disclosure decisions.
- Integration tests with fake identity, Dodo, KYC, twin, and renderer adapters.
- Concurrency tests for duplicate render requests and webhook delivery.
- Tenant-isolation tests over every customer API and artifact route.
- Smoke test for request -> accepted brief -> credit hold -> render status ->
  artifact metadata -> capture/release.
- Actor smoke test for consent -> verification -> cast -> artifact/licence ->
  earning -> withdrawal -> payout.
- Target-host acceptance with real billing test mode, private artifact playback,
  and one authorised social publish.

## Open decisions before apply

- Which repo owns the customer web app, if it is not this repository.
- Identity provider and durable database/queue selection.
- Dodo product, subscription, webhook, tax, and refund contract details.
- Verification/twin provider responsibilities and deletion APIs.
- Exact credit success boundary and customer retry policy.
- Jurisdiction-specific disclosure metadata and actor-retention schedule after
  counsel review.
