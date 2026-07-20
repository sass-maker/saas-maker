## ADDED Requirements

### Requirement: Focused private endpoint inventory
Cockpit SHALL provide an authenticated App Health workspace that lists routes discovered from the current owner's canonical performance evidence.

#### Scenario: Endpoint evidence exists
- **WHEN** one or more SDK spans exist for an owner
- **THEN** the workspace lists each project, method, normalized route template, observed sample count, error rate, p50, p95, last seen, source, and deterministic health state for the selected window

#### Scenario: No endpoint evidence exists
- **WHEN** the owner has no SDK spans in the selected window
- **THEN** the workspace displays a truthful empty state with links to the Node.js and Go installation guides and does not substitute demo data

### Requirement: Scannable filtering and states
The workspace SHALL support project and time-window filtering, sortable performance columns, and explicit healthy, degraded, unhealthy, insufficient-data, connected-empty, and unavailable states.

#### Scenario: Operator changes project
- **WHEN** the operator selects one project
- **THEN** endpoint summaries and recent activity update to only that project's evidence

#### Scenario: Evidence API is unavailable
- **WHEN** the private performance query fails or no authenticated session token is available
- **THEN** the workspace explains that evidence is unavailable and does not claim endpoints are healthy

### Requirement: Responsive accessible presentation
The App Health workspace SHALL remain usable with keyboard navigation and at desktop and narrow viewport widths, with status conveyed by text in addition to color.

#### Scenario: Narrow viewport
- **WHEN** the workspace is viewed at a mobile-width viewport
- **THEN** filters remain operable and endpoint data remains readable through responsive layout or horizontal table scrolling
