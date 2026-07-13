# anonymous-brand-reel

## ADDED Requirements

### Requirement: Anonymous single-field intake
The product SHALL let a visitor submit one public HTTPS brand website without
creating an account, purchasing credits, or connecting another service.

#### Scenario: Visitor starts a reel
- **WHEN** a visitor submits a valid public brand URL
- **THEN** the service creates an unguessable job and begins website intake without authentication or payment

### Requirement: Safe bounded website fetch
The service SHALL reject non-HTTPS, private, reserved, loopback, link-local,
metadata-service, and unsafe redirect targets, and SHALL bound request time,
redirects, response size, documents, and images.

#### Scenario: URL resolves to a private address
- **WHEN** the submitted host or any redirect resolves to a private or reserved address
- **THEN** the request is rejected before fetching that target

### Requirement: Evidence-backed brand understanding
The service SHALL extract brand facts, copy, colors, logo/product imagery, and
page captures with source provenance. It SHALL NOT present an unsupported factual
claim as website-derived.

#### Scenario: Script uses a product claim
- **WHEN** the generated script contains a factual product claim
- **THEN** the job provenance identifies the source page and extracted evidence supporting it

### Requirement: Licensed human presenter
Every successful reel SHALL visibly include a human presenter selected from a
checksum-pinned asset manifest with commercial-use licence and model-release
proof. Missing or invalid proof SHALL block composition.

#### Scenario: Presenter proof is incomplete
- **WHEN** the selected presenter lacks a valid asset checksum, commercial licence reference, or model-release reference
- **THEN** rendering fails closed and no completed artifact is exposed

### Requirement: Polished vertical composition
The service SHALL create a 9:16 MP4 combining the human presenter, supporting
brand/product visuals, narration, safe-area captions, on-screen text, and a CTA.
The output SHALL pass existing technical and self-review checks before completion.

#### Scenario: Render completes
- **WHEN** composition and review succeed
- **THEN** job metadata reports a completed 9:16 MP4 with presenter, audio, captions, duration, and provenance

### Requirement: Status, preview, and download
The service SHALL expose anonymous job status plus inline byte-range preview and
attachment download only for a completed, reviewed artifact.

#### Scenario: Visitor previews a completed reel
- **WHEN** the visitor requests preview for a completed job
- **THEN** the service returns the MP4 inline and honors valid byte-range requests

#### Scenario: Visitor requests an incomplete artifact
- **WHEN** preview or download is requested before successful review
- **THEN** no partial artifact bytes are returned and the current job state is reported

### Requirement: Lean product boundary
The anonymous product SHALL NOT expose authentication, workspaces, billing,
credits, actor onboarding/twins, KYC, earnings, payouts, marketplace, social
connections, posting, or scheduling routes or UI.

#### Scenario: Obsolete product route is requested
- **WHEN** a caller requests a removed account, billing, actor, marketplace, or publishing product route
- **THEN** the service returns not found and does not initialize that subsystem
