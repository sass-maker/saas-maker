## ADDED Requirements

### Requirement: Authenticated project derivation
The performance span ingestion API SHALL derive a missing project identity from the project authenticated by the API key before validating and storing the span.

#### Scenario: SDK omits project id
- **WHEN** a valid project API key submits a valid endpoint span without `project_id`
- **THEN** the API stores the span under the authenticated project's canonical slug

#### Scenario: SDK supplies matching project id
- **WHEN** a valid project API key submits a valid span with its own project slug or id
- **THEN** the API accepts the span under that authenticated project

#### Scenario: SDK supplies another project id
- **WHEN** a valid project API key submits a span naming a different project
- **THEN** the API rejects it with a forbidden response and stores no evidence

### Requirement: Existing validation remains authoritative
Derived project identity MUST NOT bypass span size, cardinality, provenance, route-template, sensitive-field, idempotency, or per-route volume validation.

#### Scenario: Unsafe SDK payload
- **WHEN** a key-authenticated payload omits `project_id` but includes a prohibited sensitive field or invalid route label
- **THEN** the API rejects the payload using the existing performance validation contract
