## ADDED Requirements

### Requirement: Key-only minimal setup
The Node.js SDK and Go 1.23+ SDK SHALL require only a valid SaaS Maker project API key for their minimal production configuration and SHALL default to the canonical SaaS Maker ingest endpoint. Go 1.22 SHALL remain supported with an explicit route resolver for non-root routes.

#### Scenario: Node developer installs middleware
- **WHEN** a developer constructs App Health with a project API key and installs the Express middleware
- **THEN** completed Express requests are queued for authenticated SaaS Maker ingestion without requiring a project id or slug

#### Scenario: Go developer installs middleware
- **WHEN** a developer constructs App Health with a project API key and wraps a `net/http` handler
- **THEN** completed Go requests are queued for authenticated SaaS Maker ingestion without requiring a project id or slug

### Requirement: Bounded fail-open delivery
Each SDK SHALL deliver endpoint summaries asynchronously through a bounded queue with bounded batch size, timeout, and retry behavior, and telemetry failure MUST NOT change application response behavior.

#### Scenario: Ingest is unavailable
- **WHEN** the SaaS Maker ingest endpoint times out or returns a retryable failure
- **THEN** the SDK retries only within configured bounds, records local diagnostics, and does not delay or fail the application response

#### Scenario: Queue is full
- **WHEN** completed requests exceed the SDK's bounded queue capacity
- **THEN** additional endpoint summaries are dropped and counted without blocking the request path

### Requirement: Privacy-preserving endpoint summaries
Request-derived data MUST be limited to method, normalized route template, status class or status code, duration, and observation time. Delivery MAY include generated schema, surface, environment, idempotency, trace, sampling, runtime, and optional release metadata plus the configured SaaS Maker project key as authentication. The SDKs MUST NOT collect application-request credentials, request headers, cookies, query values, request or response bodies, path parameter values, user identity, logs, or stack traces.

#### Scenario: Dynamic request path
- **WHEN** middleware observes a request containing a numeric or UUID-like route parameter and a query string
- **THEN** the emitted route uses a bounded template or placeholder and contains neither the concrete parameter nor the query value

### Requirement: Reproducible distribution artifacts
The Node package and Go module SHALL build and test as standalone consumer dependencies using their documented package and module identities.

#### Scenario: Node packed consumer
- **WHEN** CI packs the Node SDK and installs the tarball in a clean consumer fixture
- **THEN** the documented import and middleware construction typecheck and execute without workspace-only resolution

#### Scenario: Go module consumer
- **WHEN** a clean Go consumer imports the documented public module path
- **THEN** `go test` resolves the module and compiles the documented middleware setup
