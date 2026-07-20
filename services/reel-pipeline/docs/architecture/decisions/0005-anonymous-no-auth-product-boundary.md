# ADR 0005: Anonymous brand-reel product boundary (no auth, no account)

- **Status:** Accepted
- **Date:** 2026-07-13

## Context

The repo previously accumulated an unrequested HexCoded
account/billing/actor-marketplace plan and isolated product-domain code. The
actual public product is much narrower: paste a public HTTPS brand website
and get a presenter-led vertical reel — no login, account, billing, workspace,
actor onboarding, or social connection.

## Decision

Make the public root surface a single anonymous flow: one HTTPS brand URL in,
reviewed 9:16 reel out. Replace the unrequested HexCoded account/billing/
actor-marketplace plan and delete its isolated product-domain code. The flow
performs DNS-pinned, SSRF-safe bounded website extraction, builds an
evidence-backed script/storyboard, runs a presenter-led 9:16 composition
boundary, and exposes safe status, range preview, and attachment download only
after review.

The production presenter pack includes a checksum-pinned fictional synthetic
human cutout with generator provenance and an explicit non-real-identity
attestation (`assets/presenters/manifest.json`). Real likenesses remain
fail-closed without model-release proof.

## Consequences

- The anonymous surface has no authentication, workspaces, billing, credits,
  actor onboarding/twins, KYC, earnings, payouts, marketplace, customer social
  posting, or scheduling.
- `/review`, `/studio`, Significant Content, and internal accepted-marketing
  paths remain intact and are internal tooling, not visitor product surfaces.
- A target-environment canary with the checksum-pinned presenter remains an
  operator release gate; auth/billing/actor/social scope is explicitly out.
- The complete Node/Rust regression suite must continue to pass; the anonymous
  path must not add identity to the brand-reel flow.
