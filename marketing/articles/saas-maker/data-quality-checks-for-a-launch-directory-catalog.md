---
title: "Data-Quality Checks for a Launch-Directory Catalog"
slug: "data-quality-checks-for-a-launch-directory-catalog"
target_query: "data quality checks launch directory"
search_intent: "Informational - Understand how to validate and maintain the integrity of a generated product directory or catalog using scripts and automated checks."
meta_title: "How to Build Data-Quality Checks for a Launch Directory"
meta_description: "Discover a structural approach to catalog data quality. Learn how to separate private metadata from public directories and enforce strict schema checks without a traditional database."
---

## Outline

1. **Introduction**
   - The challenge of maintaining a dynamic, multi-product catalog.
   - The need for an owner-local truth source divorced from manual edits to generated directories.
2. **The Single Source of Truth: A Private JSON Source**
   - Centralizing catalog metadata in a safe, unexposed location.
   - Using an explicit schema (e.g., Schema v2) to establish bounds.
3. **Lossless Mapping and Retention Strategies**
   - Preventing destructive updates using mapping logic.
   - Retaining verbatim unknown fields instead of dropping them silently.
4. **Validating Data Integrity with Structural Scripts**
   - Schema testing and checking the source integrity using scripts.
   - Rejecting fields that would be silently lost.
5. **Protecting the Public Export**
   - Projecting a filtered public directory without leaking private operational data.
   - Why public build pipelines must never touch raw catalog data.
6. **Continuous Integration and Deploy Guardrails**
   - Enforcing exact-source verification before generating directories.
   - Tying pipeline outcomes to structural checks rather than manual QA.
7. **Conclusion**
   - Predictable quality through automated schema validation over manual corrections.
8. **Internal Link Suggestions**
9. **Practical Next Action**

---

When managing a software product directory, launch catalog, or portfolio register, the most pervasive risk is not downtime or styling errors, but data drift. Across dozens of application identities—some active, some parked, some strictly internal—metadata naturally fractures. If public-facing presentation logic is allowed to read directly from a complex, messy data layer, the presentation itself becomes fragile. Worse, if a human maintains the public-facing directory by hand-editing its source JSON, they risk inadvertently breaking links, corrupting platform metadata, or exposing internal notes intended only for the builder.

The alternative to a fragile hand-edited catalog is a generated projection backed by strict, automated data-quality checks. By treating the directory as a strict transformation pipeline, teams can maintain absolute control over the structural integrity of the catalog. The following principles explore how to establish a durable, check-driven environment for a multi-product launch directory, utilizing explicit schema boundaries and non-destructive transformations.

### The Single Source of Truth: A Private JSON Source

The foundation of robust catalog data quality is separating the owner’s raw domain metadata from what the public consumes. A directory’s raw truth must live in a private, owner-local source. It should act as an authoritative map of product identities, containing internal fields—such as financial purpose, lifecycle priority, operational state, or raw owner narratives—that are vital for internal maintenance but inappropriate for public audiences.

Establishing a versioned schema—such as a defined “Schema Version 2”—ensures that any application or script parsing the catalog understands exactly how to interpret the structures. The source file becomes a rigid database table represented as plain text.

Rather than hand-editing a public directory array and hoping the properties align, an operator modifies this private source. The separation guarantees that public-facing pages never parse raw Fleet operations data. The public site will only ever consume a carefully projected export. This immediately isolates sensitive state—such as API endpoints, infrastructure dependencies, or unlaunched experiments—from the deployed directory.

### Lossless Mapping and Retention Strategies

Data transformations often fail silently by discarding properties they don’t recognize. In a living directory, removing an unrecognized metadata field simply because a new script hasn't mapped it can destroy historical context.

A resilient catalog mapping script employs a lossless storage philosophy. It reads the raw metadata and maps known fields into their corresponding structured homes: moving a raw “portfolio.futureForm” to a “classification.futureForm” structure, or aligning “portfolio.status” under “lifecycle.portfolioStatus”.

Crucially, rather than discarding unmapped properties, the transformation script explicitly retains them. By creating an isolated “retainedFields” payload, all unmapped fields—be they legacy product flags or misnamed infrastructure keys—are kept verbatim.

When generating compatibility catalogs for other consumers, this mapping works in reverse. It ensures that an unknown or legacy field is preserved byte-for-byte. A robust script guarantees that if an inverse transformation is run, the final output matches the exact pre-migration snapshot. This approach turns a fragile data-migration step into a rigorous, verifiable action that protects owner decisions from silent deletion.

### Validating Data Integrity with Structural Scripts

Having a lossless mapping is powerful, but enforcing it requires structural quality scripts. The maintenance of a launch directory relies on a suite of discrete, executable checks designed to validate the catalog before any consumer—public or internal—ever sees it.

A well-architected repository relies on specific check scripts rather than monolithic testing frameworks to enforce boundaries:

- **Source Integrity Checks**: A script (e.g., `check-catalog-source.mjs`) is responsible for reading the raw, private JSON and verifying that it conforms precisely to the required versioned schema. If the script detects that a field is placed incorrectly or that a required project ID is missing, the check fails immediately. It actively rejects fields that would be silently lost during generation.
- **Schema Testing**: Dedicated tests (e.g., `catalog-schema.test.mjs`) validate the field mapping logic itself. They verify that when the catalog schema is transformed, known legacy fields land in the correct structured objects, and unknown fields are reliably tucked into the retained payload.
- **Operations Compatibility Verification**: To support secondary systems—like internal health checkers or dashboard endpoints—the catalog must often be represented in a compatibility view. A script generates this view and explicitly blocks duplicate directory metadata or conflicting retained fields.

By utilizing plain JavaScript or Node.js scripts for validation, the directory pipeline avoids relying on external ORMs or heavy database validation layers, making it highly portable and exceptionally fast.

### Protecting the Public Export

The most critical operation in managing a launch directory is projecting the public export. The public build pipeline must never be permitted to access or parse the private source catalog.

Instead, a synchronizing script acts as a one-way valve. It reads the authoritative private data and explicitly constructs a filtered, privacy-safe projection. This script enforces owner-level decisions: if a project's `sharing.shareable` flag is false, or if it represents a hidden operational boundary, the record is deliberately omitted from the export.

The public export only receives the fields necessary to render the directory—such as canonical public domains, presentation metadata, prominent tools, and curated changelog locations. Once generated, this filtered JSON acts as the sole data boundary for the public website.

Because the generation script handles the redaction, the front-end code of the launch directory remains remarkably simple. It doesn't need to check privacy flags or filter out unlaunched apps at runtime, significantly reducing the risk of a bug accidentally leaking internal details. The generated file is checked into version control, meaning the public site can be built and deployed securely without runtime access to the private state.

### Continuous Integration and Deploy Guardrails

Automated checks are only useful if they act as hard guardrails. The entire data-quality pipeline is enforced by the project’s Continuous Integration (CI) and build lifecycle.

Rather than relying on human diligence to run validation scripts, a dedicated command (e.g., a "deploy guard") acts as a gatekeeper. Before the launch directory can be built or deployed, the deployment script executes a complete synchronization and validation pass. It triggers the schema tests, checks the source integrity, verifies the operations map, and ensures the generated public projection perfectly reflects the current source state.

If the owner has manually modified the public projection, or if an edit to the private source introduces a malformed record, the checks fail and block the deployment. CI is configured to require exact-source successful execution. This ensures that what reaches production is an explicitly authorized, structurally sound, and privacy-filtered map of the builder’s portfolio.

### Conclusion

Maintaining a dynamic launch directory without a traditional database is not only possible but, when governed by strict data-quality checks, highly resilient. By completely separating private, owner-local source truth from a generated public projection, developers protect sensitive operational context.

Relying on lossless schema mapping ensures historical data is never discarded accidentally, while explicit validation scripts—from schema testing to structural source checks—catch errors before they propagate. Bound together by continuous integration guardrails, these principles ensure that the public directory remains a predictable, living record of product identities, free from data drift and manual editing mistakes.

---

### Internal Link Suggestions
- Link to documentation detailing the specific **schema mapping** inside your catalog setup.
- Link to your team’s **CI deploy guard** guides.
- Link to the **portfolio project strip package** documentation as an example of an application safely consuming the generated export.

### Practical Next Action
Review your current public launch directory or catalog. Identify if public front-ends are querying data that contains private or internal-only fields. If so, draft a simple Node script to generate a stripped-down, privacy-filtered JSON projection, and configure your site to read solely from that output.

---

### Source Notes (Non-Publishable)
- **Data Source Structure & Privacy**: `catalog/README.md` details that the raw private source lives in `catalog/projects.json` and is strictly owner-local, enforcing Schema version 2. It explicitly states that public builds consume only the generated `generated/public.json` export and never read private state at runtime.
- **Lossless Storage & Retention**: `scripts/catalog-schema.mjs` clearly implements the `fieldMap` logic, demonstrating how known fields are mapped and unknown fields are packed into `retainedFields` and kept verbatim.
- **Data-Quality Checks**: `package.json` and `catalog/README.md` outline discrete check commands such as `catalog:test-schema`, `catalog:check-source` (via `scripts/check-catalog-source.mjs`), and `catalog:check-operations`. These scripts reject fields that would be silently lost and test structural integrity.
- **Deployment Guards**: The CI context and deploy process (mentioned in `PROJECT_STATUS.md` and `package.json`) enforce these boundaries (e.g., `deploy:guard`) so that production state relies on an authorized synchronization pass without reading private owner data at runtime.
