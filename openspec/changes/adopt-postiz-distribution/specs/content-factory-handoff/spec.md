## ADDED Requirements

### Requirement: Versioned generation input
The Content Factory SHALL accept a versioned brief containing project identity,
source provenance, requested formats, channel intent, and content approval. It
MUST reject unapproved or unsupported input without rendering or distribution.

#### Scenario: Approved brief enters generation
- **WHEN** Foundry submits a supported brief with recorded content approval
- **THEN** Content Factory creates one idempotent generation run tied to that brief version

#### Scenario: Unapproved brief is rejected
- **WHEN** a brief lacks content approval
- **THEN** Content Factory records a validation failure and produces no asset

### Requirement: Immutable artifact manifest
Every completed generation run SHALL emit an immutable manifest containing the
input hash, renderer and version, generated variants, asset checksums and
locations, quality evidence, provenance, and review state.

#### Scenario: Render passes quality review
- **WHEN** a renderer completes and the configured quality gate passes
- **THEN** the manifest records the verified assets and becomes eligible for owner review

#### Scenario: Render fails quality review
- **WHEN** a required quality check fails or is unavailable
- **THEN** the manifest remains in review or failed state and cannot enter distribution

### Requirement: Generation cannot publish
Content Factory SHALL NOT receive social-provider credentials, create schedules,
or publish content. Its only outbound distribution action SHALL be returning a
verified artifact manifest to Foundry.

#### Scenario: Provider credentials are absent
- **WHEN** Content Factory runs in any environment
- **THEN** its runtime contract requires no Instagram, YouTube, TikTok, or Postiz credential

### Requirement: Existing renderer migration
Existing Reel Pipeline renderers SHALL remain usable only through the Content
Factory adapter boundary until individually retained or removed with evidence.

#### Scenario: Legacy renderer is invoked
- **WHEN** a retained legacy renderer processes a supported brief
- **THEN** its output is normalized into the same artifact manifest as every other renderer

