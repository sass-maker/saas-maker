# HexCoded self-serve product

## Why

Reel Pipeline can intake approved briefs, render videos, review artifacts, and
hand accepted work to YouTube or Instagram. HexCoded's public product and legal
documents describe a materially larger product: customer accounts, URL-to-ad
creation, credit billing, actor casting, verified AI twins, actor earnings, and
durable consent/licence records.

The immediate risk is presenting internal pipeline capabilities as a complete
customer SaaS. This change closes that gap in explicit stages, beginning with a
brand-only self-serve product that can be operated safely before the actor
marketplace is enabled.

## What Changes

### Phase 1 — brand self-serve foundation

- Add authenticated customer and workspace boundaries around reel intake,
  review, rendering, artifacts, and posting connections.
- Add a customer URL-to-ad workflow that converts a product URL and campaign
  inputs into a reviewable brief, render, and downloadable output.
- Add a Dodo-backed purchase/subscription integration and an idempotent credit
  ledger. Credits are held before rendering, captured once on success, and
  released on technical failure.
- Move customer jobs from local file state to durable, retryable execution with
  tenant-scoped artifacts and an auditable state machine.
- Record Terms/Privacy acceptance versions and output provenance, including
  render engine, source assets, voice/music providers, and AI-disclosure
  metadata.

### Phase 2 — actor marketplace

- Add actor onboarding, explicit Actor Licence acceptance, identity/liveness
  verification, face/voice asset handling, and AI-twin lifecycle controls.
- Add an actor library and casting contract that binds each generated output to
  the exact actor licence and permitted use in force at generation time.
- Add actor earnings, chargeback adjustments, payout thresholds, KYC/tax
  status, payout history, and the ability to stop future twin use.
- Add consent receipts, misuse reporting, takedown handling, and retention rules
  that do not require keeping master biometric recordings merely because a
  delivered video licence is perpetual.

### Phase 3 — production and launch gates

- Prove customer render, billing, artifact playback, and authorised posting on
  the target host.
- Add abuse controls, content-policy checks, claim/evidence review, operational
  observability, deletion/export, and incident/audit tooling.
- Keep actor casting disabled until actor-consent, licence, earnings, and payout
  acceptance tests pass end to end.

## Capabilities

### New Capabilities

- `hexcoded-product`: authenticated workspaces, URL-to-ad creation, commercial
  metering, durable execution, provenance, actor licensing, and launch gates.

### Modified Capabilities

- Existing reel intake, render, review, artifact, and posting paths become
  workspace-aware and must preserve their current approval gates.

## Scope

### In scope

- Product contracts and backend behavior owned by `reel-pipeline`.
- Explicit integration contracts for the customer app, Dodo, identity/KYC,
  voice/face processors, R2, SaaS Maker, YouTube, and Instagram.
- Migration of existing internal/operator flows without weakening accepted-item
  and explicit-posting gates.

### Out of scope

- Launching or deploying the product as part of this proposal.
- Enabling real actors before the actor acceptance suite passes.
- Editing vendored render engines when an adapter path exists.
- Training a proprietary foundation video model.
- Television, print, billboard, or other offline actor licences.

## Impact

- New durable domain records for users, workspaces, jobs, credits, purchases,
  acceptances, provenance, actors, licences, consent receipts, earnings, and
  payouts.
- Authentication and authorisation added to the current unauthenticated Node
  control routes and artifact access.
- Existing Rust orchestration and renderer adapters remain the execution core;
  SaaS Maker remains the source of truth for fleet marketing ideas and approval
  state, not customer identity, billing, or actor data.
- Production dependencies and processor choices require explicit review before
  implementation.

## Success Criteria

1. A new brand can sign in, create a workspace, purchase credits, submit a
   product URL, approve a brief, render a video, and download it without
   operator filesystem access.
2. Exactly one credit capture occurs for one successful generation; technical
   failure releases the hold, including after retries or duplicate callbacks.
3. No customer can read or mutate another workspace's jobs or artifacts.
4. Every delivered output has a reproducible provenance/licence record.
5. A real actor can consent, be verified, be cast, accrue the correct earning,
   stop future use, and receive a payout while previously delivered licences
   remain verifiable.
6. Target-host readiness is green for the enabled product slice before public
   launch.
