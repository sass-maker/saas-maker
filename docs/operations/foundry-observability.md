---
title: Foundry observability contract
description: Provider-neutral source inventory and verification states for maintained Foundry projects.
---

## Purpose

Foundry observability is a contract and evidence inventory, not a mandate to use
one telemetry vendor. A project can use Cloudflare Workers Observability,
PostHog, OpenTelemetry, Sentry, Foundry Events, local logging, or a custom
adapter when that choice matches its runtime and privacy boundary.

The inventory answers two different questions:

1. What observability adapters are configured in source?
2. Is there recent, successful evidence that an adapter works?

Source configuration never proves live delivery. The report keeps those claims
separate so a PostHog import, a Wrangler observability block, or a Sentry setup
cannot be presented as current production health without a verification receipt.

The canonical TypeScript shapes live in
internal/contracts/observability.ts. The scanner and report generator live in
scripts/foundry-observability-core.mjs and
scripts/foundry-observability-inventory.mjs.

## Contract dimensions

Each adapter records:

| Dimension | Meaning |
| --- | --- |
| Provider | The transport or store. Provider choice is explicit and neutral. |
| Purpose | Analytics, audit, availability, errors, jobs, logs, performance, security, or traces. |
| Runtime | API, browser, worker, server, job, CLI, desktop, mobile, local tool, or unknown. |
| Privacy | Data classification and fixed rules for secrets, identities, payload bodies, and redaction. |
| Collection | Manual, automatic, or hybrid collection plus delivery behavior and captured signal classes. |
| Freshness | Maximum acceptable receipt age and the timestamp/path of local verification evidence. |
| Verification | Source-configured, fresh-verified, stale, unknown, or not-applicable. |

Provider configuration can list environment variable names. It must never
contain resolved values, authorization headers, cookies, tokens, DSNs, or
credentials.

## Verification states

| State | Required evidence |
| --- | --- |
| source-configured | A recognized adapter exists in source, but no valid successful receipt was found. |
| fresh-verified | A successful local receipt has a valid timestamp within the freshness target. |
| stale | The newest successful local receipt is older than the freshness target. |
| unknown | Maintained source is absent, or neither an adapter nor trustworthy evidence can be identified. |
| not-applicable | The registry explicitly excludes the project and supplies a non-empty reason. |

File modification time is not verification evidence. A receipt must contain a
successful state, such as pass, passed, ok, or fresh-verified, and one of
observedAt, verifiedAt, checkedAt, or generatedAt. Receipt filenames should
clearly combine observability or monitoring with verification, receipt, audit,
or report.

A typical sanitized receipt is:

    {
      "status": "pass",
      "verifiedAt": "2026-07-19T10:00:00.000Z",
      "auditPath": "reports/observability-check.json"
    }

The referenced audit path must exist inside the project. Absolute paths and
paths that leave the project boundary fail the audit-path check.

## Source inventory

Run the report from the Foundry repository:

    node scripts/foundry-observability-inventory.mjs \
      --root . \
      --output /tmp/foundry-observability.json \
      --markdown-output /tmp/foundry-observability.md

JSON can be written with --output or printed with --format json. Markdown is
the default stdout format and can be written with --markdown-output.

Useful bounded controls:

    --max-files 4000
    --max-file-bytes 1048576
    --max-total-bytes 33554432
    --freshness-hours 168

The scanner reads one bounded file at a time. It does not concatenate a
project, repository, or fleet into a single string. It never follows symlinks.
It excludes node_modules, .git, build outputs, dependency vendor directories,
caches, test fixtures, lockfiles, minified files, environment files, private
key/certificate formats, and the inventory implementation itself.

The scan root is also a filesystem boundary. Registry paths outside that root
are not followed. Maintained registry entries whose source is not available
below the root remain unknown.

When the root contains the Foundry monorepo, imported maintained projects under
services and tools are inventoried separately. Their directories are excluded
from the parent SaaS Maker scan to avoid duplicate ownership.

## Findings

The inventory reports:

- Event consumers with no source producer and producers with no source
  consumer. A producer without a local consumer is informational because an
  external dashboard can be the intended consumer.
- Exact events produced by multiple source owners.
- Event families emitted through multiple provider adapters in one project.
- Hardcoded public telemetry keys when their format is identifiable. Reports
  include provider, relative file, and line, but omit the value.
- Event emitters without a detectable canonical project_id field.
- Missing, absolute, or boundary-escaping audit paths from local receipts,
  event catalogs, and observability verification package scripts.
- File or byte caps reached before a project scan completed.

Event family is the prefix before the first underscore. For example,
foundry_error and foundry_trace belong to the foundry family. Provider overlap
is reported for operator review; it is not automatically treated as a runtime
failure.

## Sanitization

The scanner does not read environment files. It stores only repository-relative
source paths and environment variable names. Source snippets and matched key
values are never added to the report.

Before JSON or Markdown is returned, a final recursive sanitizer redacts common
public-client keys, DSNs, bearer values, GitHub tokens, and credential-shaped
fields. Sanitization is defense in depth; source collection must still avoid
secret values in the first place.

The generated report is an internal operational artifact. Review it before
publishing because filenames, event names, and project topology can still be
operationally sensitive even when credentials are absent.

## Relationship to existing monitoring

The existing Cockpit browser and server readers remain PostHog adapters. Worker
observability blocks remain Cloudflare adapters. Foundry Events and other local
telemetry paths are separate adapters. None is promoted to a universal
dependency by this contract.

scripts/fleet-monitoring-audit.mjs remains the legacy PostHog-oriented source
coverage check. scripts/fleet-posthog-verify.mjs remains an optional live
PostHog query that requires credentials and network access. This inventory does
not call either provider, read their credentials, or replace their specialized
checks.

For an offline source pass:

    node --test tests/foundry-observability*.test.mjs
    node scripts/foundry-observability-inventory.mjs \
      --root . \
      --output /tmp/foundry-observability.json
    git diff --check

No network, deployment, rate-limit change, package installation, or production
mutation is part of this workflow.
