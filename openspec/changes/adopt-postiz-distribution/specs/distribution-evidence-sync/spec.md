## ADDED Requirements

### Requirement: Bounded Postiz reconciliation
The synchronizer SHALL query only configured integrations and known recent or
active Postiz post IDs, with a persisted cursor, time budget, and item limit.

#### Scenario: Scheduled poll completes
- **WHEN** the operations host runs the evidence synchronizer
- **THEN** it processes a bounded page, persists its cursor, and emits a receipt

### Requirement: Explicit evidence freshness
Every distribution and analytics record SHALL include source, observed time,
and one of `fresh`, `stale`, `failed`, or `unmeasured`. Last-known-good values
MUST retain their original observation time.

#### Scenario: Postiz is unavailable
- **WHEN** synchronization cannot reach Postiz
- **THEN** existing values become stale according to policy and are not reported as fresh

### Requirement: Provider provenance
Foundry SHALL preserve the Postiz post ID, integration ID, platform identifier,
release status, release identifier when available, and original metric labels
needed to explain normalized values.

#### Scenario: Metrics differ by platform
- **WHEN** one platform reports impressions and another reports views
- **THEN** Foundry preserves both labels and applies only documented normalization

### Requirement: Privacy-minimized collection
The synchronizer MUST NOT ingest access tokens, comments, direct messages,
follower identities, unpublished unrelated content, or full account payloads.

#### Scenario: Upstream response contains extra fields
- **WHEN** Postiz returns fields outside the evidence allowlist
- **THEN** the synchronizer discards them before persistence or logging

### Requirement: Feedback-loop output
Distribution evidence SHALL be attributable to the originating project,
campaign, brief, artifact, and experiment so Foundry can compare outcomes and
produce evidence-backed recommendations.

#### Scenario: Published post gains engagement
- **WHEN** fresh analytics arrive for a mapped Postiz post
- **THEN** Foundry updates the campaign evidence without creating product work automatically

