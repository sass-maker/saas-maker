## ADDED Requirements

### Requirement: Postiz is the sole publisher
After cutover, the system SHALL execute all social drafts, schedules, immediate
publications, retries, and provider connections through one Foundry-owned Postiz adapter.
Direct Reel Pipeline publisher paths MUST be disabled.

#### Scenario: Approved distribution is scheduled
- **WHEN** a verified artifact has explicit distribution approval and a valid connected integration
- **THEN** the adapter creates or promotes exactly one Postiz post for the requested time

#### Scenario: Direct legacy publishing is attempted
- **WHEN** a legacy Reel Pipeline publisher is invoked after cutover
- **THEN** it fails closed without making a provider request

### Requirement: Two-stage approval
The adapter SHALL require both content approval and distribution approval.
Creating a Postiz draft for review MUST NOT imply permission to schedule or
publish it.

#### Scenario: Draft without distribution approval
- **WHEN** approved content has a verified artifact but no distribution approval
- **THEN** the system may create a Postiz draft but MUST NOT schedule or publish it

### Requirement: Idempotent delivery mapping
The adapter SHALL persist a unique mapping from distribution request, content
hash, and integration to the Postiz post ID before treating creation as
successful. Retries MUST reuse the mapping unless replacement is explicitly
approved.

#### Scenario: Retry after ambiguous response
- **WHEN** a create request times out and the same distribution request retries
- **THEN** the adapter reconciles known Postiz state before creating any replacement

#### Scenario: Host failover repeats work
- **WHEN** another host receives a request already mapped to a Postiz post
- **THEN** it returns the existing mapping and does not create a duplicate

### Requirement: Server-side credentials
Postiz base URL, API key, provider configuration, and OAuth material SHALL remain
outside git and server-side. Logs, receipts, and Cockpit responses MUST redact
credential-shaped values.

#### Scenario: Cockpit reads distribution state
- **WHEN** an authenticated operator opens a marketing item
- **THEN** Cockpit receives normalized state and identifiers but no Postiz credential

### Requirement: Classified bounded failures
The adapter SHALL classify validation, authentication, throttling, provider,
network, and unknown failures. Only transient classes MAY receive bounded retry
with jitter.

#### Scenario: Postiz rejects platform settings
- **WHEN** Postiz returns a deterministic validation error
- **THEN** Foundry marks the request blocked for review and does not retry automatically
