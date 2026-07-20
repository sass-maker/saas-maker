## ADDED Requirements

### Requirement: Private Speed workspace
Cockpit SHALL provide an authenticated `/fleet/speed` workspace under the Visibility pillar. Unauthenticated users MUST NOT receive fleet performance evidence.

#### Scenario: Operator opens Speed
- **WHEN** an authenticated operator navigates to `/fleet/speed`
- **THEN** Cockpit renders fleet coverage, freshness, web speed, API speed, and regressions from the provider-neutral query API

#### Scenario: Anonymous visitor requests Speed
- **WHEN** an unauthenticated visitor requests the Speed page or its backing endpoints
- **THEN** the system redirects to authentication or returns an authorization error without evidence data

### Requirement: Explicit coverage and freshness
The Speed workspace SHALL distinguish fresh, stale, unmeasured, and failing surfaces and SHALL display the newest observation time, source, environment, sample count, and revision where known.

#### Scenario: Provider is configured but no evidence arrived
- **WHEN** the source inventory recognizes a provider but no fresh receipt exists
- **THEN** the surface is shown as unmeasured or stale rather than healthy

### Requirement: Fleet speed overview
The workspace SHALL provide a dense fleet table with web Core Web Vitals distributions, API latency distributions, traffic sample count, error rate, evidence source, and regression state for each declared surface.

#### Scenario: Product has web and API surfaces
- **WHEN** a product has fresh web and API receipts
- **THEN** its fleet row exposes both lanes without combining unlike metrics into one score

### Requirement: API activity views
The workspace SHALL provide recent API requests, top route templates by volume, slowest route templates by selectable percentile, and highest-error routes for explicit time windows.

#### Scenario: Operator filters top calls
- **WHEN** the operator selects a project and 24-hour window
- **THEN** top-call tables and charts update to that project/window and retain source and sample-count labels

### Requirement: Route and downstream drill-down
The workspace SHALL provide route detail with latency/throughput/error trends, status classes, cold/warm synthetic comparison, recent sanitized spans, and summarized downstream-operation contributions when available.

#### Scenario: Operator opens a slow route
- **WHEN** a route has runtime and downstream-operation evidence
- **THEN** Cockpit shows which sanitized operation fingerprints contributed time and links them through trace identifiers

### Requirement: Web diagnostics drill-down
The workspace SHALL show web performance distributions and link to available PSI Swarm diagnostic artifacts without duplicating the full PSI Swarm diagnostic interface.

#### Scenario: Web regression has a PSI artifact
- **WHEN** a regressed web receipt contains a valid diagnostic reference
- **THEN** Cockpit presents the distribution change and a safe link or host action to inspect the detailed artifact

### Requirement: Provenance-aware trends
Charts and comparisons MUST label evidence source, environment, time window, sample count, and revision and MUST NOT graph incompatible sources as one continuous series.

#### Scenario: Source changes during a time range
- **WHEN** a route has PostHog-imported history followed by Foundry runtime spans
- **THEN** the chart visually separates or filters the source series rather than implying one homogeneous dataset

### Requirement: Observation mode and budgets
The workspace SHALL show whether each surface is observing, alerting, or enforcing and SHALL require explicit owner confirmation before activating a suggested performance budget.

#### Scenario: Baseline suggests a budget
- **WHEN** enough observations exist to calculate a suggested threshold
- **THEN** Cockpit displays the suggestion as inactive until the owner explicitly approves it

### Requirement: Existing observability inventory remains distinct
The static provider/configuration inventory SHALL remain available and SHALL link to Speed, while the current PostHog-only latency card SHALL be retired only after the Speed workspace reaches functional parity.

#### Scenario: Speed has no provider enrichment
- **WHEN** PostHog credentials are absent but synthetic receipts exist
- **THEN** Speed renders synthetic evidence and clearly marks provider enrichment unavailable

