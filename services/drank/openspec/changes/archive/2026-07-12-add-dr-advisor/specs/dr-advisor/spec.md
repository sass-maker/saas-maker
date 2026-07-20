## ADDED Requirements

### Requirement: Advice generation is explicit and measurement-grounded
The system SHALL request advice only after the user explicitly asks to explain a
domain, and SHALL send only its normalized domain, current DR, and bounded trend
summary to the configured server-side gateway.

#### Scenario: User asks for an explanation
- **WHEN** a tracked domain has a current DR and the user selects Explain
- **THEN** the server requests one structured advisor response grounded in that DR and trend

#### Scenario: User only opens history
- **WHEN** the user views a domain without selecting Explain
- **THEN** the system makes no advisor request

### Requirement: Advice distinguishes observation from inference
The system SHALL return a short explanation, an evidence-limit disclosure, and
three to five prioritized actions, and MUST NOT claim access to paid backlink
metrics or site-specific referring-domain evidence.

#### Scenario: Valid advice is returned
- **WHEN** the provider returns a response matching the advisor contract
- **THEN** the UI labels the observed DR/trend separately from general guidance

#### Scenario: Provider invents or malformed output
- **WHEN** provider output fails structured validation
- **THEN** the server rejects it and the UI shows a retryable unavailable state

### Requirement: Credentials remain server-side
The system SHALL call free-ai from a Cloudflare Pages Function and MUST NOT
expose the gateway credential in the client bundle or browser storage.

#### Scenario: Gateway is not configured
- **WHEN** the Pages Function has no gateway credential
- **THEN** it returns a clear unavailable response without attempting generation

### Requirement: Successful advice is cached locally
The system SHALL cache valid advice in browser storage by domain and current
measurement bucket, and SHALL allow the user to regenerate it explicitly.

#### Scenario: Matching cached advice exists
- **WHEN** the user opens a domain with advice matching its current measurement bucket
- **THEN** the UI shows that cached advice without an automatic network request

#### Scenario: DR or trend materially changes
- **WHEN** the current measurement produces a different cache key
- **THEN** stale advice is not presented as current

### Requirement: Advisor failure does not break tracking
The system SHALL preserve normal DR history, refresh, and export behavior when
the advisor gateway is missing, unreachable, rate-limited, or returns invalid
output.

#### Scenario: Generation fails
- **WHEN** the advisor request fails
- **THEN** the domain detail continues showing DR history and a quiet retry action

