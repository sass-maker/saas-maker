## ADDED Requirements

### Requirement: Normalized API request spans
Maintained API adapters SHALL emit a versioned normalized span containing project, surface, environment, method, route template, status class, duration, timestamp, source, and revision when known. Telemetry failure MUST NOT fail or delay the product request.

#### Scenario: Successful request is sampled
- **WHEN** a successful API request is selected by the bounded sampling policy
- **THEN** the adapter emits a normalized asynchronous span without request payload data

#### Scenario: Telemetry delivery fails
- **WHEN** Foundry or an optional provider is unavailable
- **THEN** the product request completes normally and the adapter does not retry without a configured bound

### Requirement: Recent API activity
The private API SHALL provide recent sanitized request spans ordered by observation time with project, route template, method, status class, duration, source, and trace correlation identifiers.

#### Scenario: Operator views latest calls
- **WHEN** an authenticated Cockpit operator requests recent API activity
- **THEN** the response contains only sanitized sampled spans within retention and never includes raw URLs or payloads

### Requirement: Top and slow API calls
The system SHALL aggregate API traffic by normalized project and route template to provide request count, error rate, and p50, p75, p95, and p99 latency for explicit time windows.

#### Scenario: Operator ranks routes by volume
- **WHEN** Cockpit requests top calls for the last 24 hours
- **THEN** results are ordered by sampled request count and include the sample rate/source needed to interpret volume

#### Scenario: Operator ranks routes by latency
- **WHEN** Cockpit requests slowest calls for the last 24 hours
- **THEN** results are ordered by a selected percentile and include sample count so low-volume outliers are visible

### Requirement: Sanitized downstream operation spans
Runtime adapters MAY attach bounded downstream-operation spans using an allowlisted operation label and stable fingerprint. The system MUST reject raw SQL, bind values, URL query strings, payloads, credentials, and user content.

#### Scenario: Database operation is recorded
- **WHEN** an instrumented request executes an allowlisted D1 operation
- **THEN** the system records the operation kind, label, fingerprint, duration, success state, and parent trace identifier without SQL text or values

#### Scenario: Sensitive field is submitted
- **WHEN** an ingestion payload contains a prohibited field or an unnormalized query string
- **THEN** the system rejects the affected span and records a sanitized validation finding

### Requirement: Bounded cardinality and sampling
The observability adapters and ingestion API SHALL enforce bounded route labels, operation labels, event size, per-route sampling, and per-minute volume. Successful, slow, and failed requests MAY use different sample rates, but every stored aggregate MUST identify its sampling basis.

#### Scenario: High-cardinality route appears
- **WHEN** dynamic identifiers cause a route label to exceed cardinality limits
- **THEN** the adapter normalizes the route or the ingestion API rejects it without creating unbounded dimensions

### Requirement: Trace-to-operation correlation
Recent request spans SHALL support correlation with sanitized downstream operations through generated trace identifiers that contain no user identity.

#### Scenario: Slow request has downstream work
- **WHEN** an operator opens a sampled slow API request
- **THEN** Cockpit can retrieve the duration contribution of its recorded downstream operations without revealing payload data

### Requirement: Compatibility during event migration
The system SHALL provide bounded compatibility mapping for existing `api_call_timing` and `foundry_trace` evidence and SHALL identify imported source semantics. New runtime instrumentation MUST use the versioned Foundry contract.

#### Scenario: Existing PostHog timing is imported
- **WHEN** a compatibility adapter reads a supported historical timing event
- **THEN** it maps available fields into a provider-labeled receipt and does not infer fields absent from the source

### Requirement: Privacy-preserving defaults
Performance telemetry MUST NOT collect authorization headers, cookies, IP addresses, stable user identifiers, raw request or response bodies, raw URL query values, SQL text, SQL values, or secrets by default.

#### Scenario: Operator inspects a recent span
- **WHEN** a recent span is rendered in Cockpit
- **THEN** every displayed field is drawn from the explicit sanitized contract and no hidden raw payload is returned to the browser

