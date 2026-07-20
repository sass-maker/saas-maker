## ADDED Requirements

### Requirement: Versioned performance evidence
The system SHALL accept and store versioned, provider-neutral performance receipts for declared fleet surfaces. Every receipt MUST identify its project, surface, environment, evidence source, observation window, ingestion time, sample count, and revision when known.

#### Scenario: Synthetic API receipt is accepted
- **WHEN** an authenticated project submits a valid API performance receipt for a declared surface
- **THEN** the system stores the receipt with its provenance and returns a stable receipt identifier

#### Scenario: Unknown project is rejected
- **WHEN** a caller submits a receipt for a project outside its authenticated project scope
- **THEN** the system rejects the receipt without storing partial evidence

### Requirement: Distributional metrics
The system SHALL store latency distributions with sample counts rather than presenting a single run as representative. API rollups MUST support p50, p75, p95, and p99 total latency; web rollups MUST support available Core Web Vitals distributions and MAY retain p90 for PSI Swarm compatibility.

#### Scenario: Partial timing phases remain explicit
- **WHEN** a probe runtime cannot expose DNS, connect, or TLS timing
- **THEN** the receipt marks those phases unavailable and does not record fabricated zero values

### Requirement: Evidence provenance separation
The system MUST keep synthetic, browser RUM, server runtime, PostHog, Cloudflare, CrUX, and imported evidence distinguishable by source and observation window.

#### Scenario: Providers disagree
- **WHEN** synthetic and runtime evidence report different latency for the same surface
- **THEN** Cockpit can retrieve both records independently and the ingestion layer does not merge their samples into one percentile

### Requirement: Catalog-declared performance surfaces
The canonical Foundry catalog SHALL declare web and API performance surfaces, safe probe methods and URLs, expected statuses, timeouts, criticality, and any owner-approved budgets. Generated consumers MUST derive from the catalog rather than maintain a second hand-edited registry.

#### Scenario: Product lacks a performance declaration
- **WHEN** a maintained product has no declared performance surface
- **THEN** generated coverage reports the product as unmeasured rather than healthy

### Requirement: Bounded safe synthetic probes
The operations runner SHALL probe only catalog-declared public web URLs and anonymous health or explicitly approved read-only API endpoints. Probes MUST use bounded concurrency, timeouts, sample counts, and non-mutating methods.

#### Scenario: Mutating endpoint is configured
- **WHEN** a performance surface declares a mutating method without an explicit future schema allowance
- **THEN** catalog validation fails before the runner can execute it

#### Scenario: Cold and warm API samples run
- **WHEN** the daily API sweep executes for a valid surface
- **THEN** it records separate bounded cold-client and warm-client distributions with the probe origin and timestamp

### Requirement: PSI Swarm integration
The web performance lane SHALL adapt PSI Swarm run output into the common receipt contract while preserving links or identifiers for its detailed local diagnostics.

#### Scenario: Weekly web sweep completes
- **WHEN** PSI Swarm completes repeated audits for a catalog URL
- **THEN** Foundry receives a web receipt containing distributions, sample count, source, environment, and diagnostic reference

### Requirement: Freshness and regression semantics
The system SHALL derive explicit fresh, stale, unmeasured, and failing states from each surface's evidence contract. A regression MUST include comparable sources/windows, minimum sample count, relative delta, and minimum absolute delta.

#### Scenario: Old successful evidence exists
- **WHEN** the newest successful receipt exceeds the surface freshness limit
- **THEN** the surface is stale even if its last measured result passed

#### Scenario: Small noisy delta occurs
- **WHEN** a percentile exceeds the relative regression threshold but not the minimum absolute delta
- **THEN** the system does not classify the surface as regressed

### Requirement: Observation-only rollout
Performance evidence SHALL remain non-blocking for at least the initial owner-approved observation window. Budgets and alerts MUST be scoped per surface and MUST NOT become active without explicit owner approval.

#### Scenario: Slow result during baseline period
- **WHEN** a result exceeds a suggested budget during observation-only mode
- **THEN** the system records and displays the result without failing a deployment

### Requirement: Retention classes
The system SHALL apply separate bounded retention classes to recent spans and aggregate rollups and SHALL expose retention and ingestion-volume status to the operator.

#### Scenario: Recent span expires
- **WHEN** a span exceeds the configured short retention period
- **THEN** it is eligible for bounded cleanup while aggregate rollups remain available

