## ADDED Requirements

### Requirement: Copy-paste installation guides
Canonical public Markdown documentation SHALL provide independently complete Node.js/Express and Go `net/http` installation recipes using real package identities, the canonical API key variable, safe shutdown, and a verification request.

#### Scenario: Coding agent follows Node guide
- **WHEN** a coding agent reads only the Node.js installation page
- **THEN** it can install the package, add middleware in the correct order, supply the key, close the client, and verify endpoint evidence without guessing unpublished names or project identifiers

#### Scenario: Coding agent follows Go guide
- **WHEN** a coding agent reads only the Go installation page
- **THEN** it can install the module, wrap a handler, supply the key, close the client, and verify endpoint evidence without guessing repository paths or project identifiers

### Requirement: Agent-readable installation manifest
The public docs surface SHALL expose a non-JavaScript machine-readable App Health installation manifest linked from `llms.txt`, `/api/ai`, and a Markdown-readable entrypoint.

#### Scenario: Agent discovers App Health
- **WHEN** an agent fetches SaaS Maker's documented AI discovery surface
- **THEN** it receives the App Health docs URL, manifest URL, supported runtimes, package identities, required environment variable, verification steps, and privacy boundary

### Requirement: Checked-in visual proof
The repository SHALL contain current screenshots of the App Health endpoint inventory at desktop and narrow viewport sizes, generated from deterministic non-production fixture data.

#### Scenario: UI changes are reviewed
- **WHEN** the App Health workspace is materially changed
- **THEN** reviewers can inspect checked-in desktop and narrow screenshots that contain no production credentials or customer data
