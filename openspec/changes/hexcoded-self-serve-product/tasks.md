# Tasks — HexCoded self-serve product

## 0. Decisions and boundaries

- [ ] 0.1 Confirm the customer-app repository and record the API ownership boundary
- [ ] 0.2 Choose the auth provider, durable database, and job-queue implementation with production-dependency approval
- [ ] 0.3 Confirm Dodo checkout/webhook/refund semantics and define the credit success boundary
- [ ] 0.4 Confirm identity, liveness, twin, voice, KYC, payout, deletion, and retention contracts
- [ ] 0.5 Reconcile the public Terms/Privacy/Actor Licence claims with the phased launch flags

## 1. Brand self-serve foundation

- [ ] 1.1 Add durable users, workspaces, membership roles, and legal-acceptance records
- [ ] 1.2 Add authentication middleware, workspace authorisation, restricted CORS, and tenant-isolation tests
- [ ] 1.3 Add workspace-scoped campaigns, briefs, render jobs/attempts, artifacts, and audit events
- [x] 1.4 Implement the customer URL-to-ad draft/review flow over the existing VideoBrief contract
- [ ] 1.5 Add private artifact delivery and customer render history/download APIs
- [x] 1.6 Preserve approval gates and prove the existing internal SaaS Maker flow still works

## 2. Billing and credit ledger

- [ ] 2.1 Add purchases, persisted billing-event inbox, signature verification, and idempotency
- [ ] 2.2 Add append-only credit accounts/entries with hold, capture, release, expiry, refund, and chargeback operations
- [ ] 2.3 Gate render enqueue on a credit hold and reconcile success/failure exactly once
- [ ] 2.4 Add customer balance/history and subscription/cancellation state APIs
- [ ] 2.5 Test duplicate submissions, duplicate/out-of-order webhooks, retries, terminal failures, refunds, and insufficient balance

## 3. Provenance, disclosure, and abuse controls

- [x] 3.1 Add customer input-rights attestations and immutable output provenance/licence records
- [ ] 3.2 Record source assets, models/providers, actor status, review state, and disclosure decision for every output
- [ ] 3.3 Add synthetic-content label/metadata support appropriate to the enabled jurisdictions and platforms
- [ ] 3.4 Add policy checks, claim/evidence review, misuse reporting, takedown, appeal, and repeat-abuse controls
- [ ] 3.5 Add customer export/deletion and purpose-bound retention jobs with audit evidence

## 4. Durable production execution

- [ ] 4.1 Replace customer-facing file-backed jobs with durable queued execution, leases, heartbeats, and bounded retries
- [ ] 4.2 Make render dispatch/completion, artifact publication, credit settlement, and posting idempotent
- [ ] 4.3 Add outbox/inbox handling for Dodo, SaaS Maker, renderer, and social-provider side effects
- [x] 4.4 Add structured observability without logging credentials, biometric inputs, or unnecessary customer content
- [ ] 4.5 Run the brand smoke: sign-in -> URL -> accepted brief -> hold -> render -> artifact -> capture/release

## 5. Actor marketplace

- [x] 5.1 Add actor role/profile and versioned Actor Licence acceptance before biometric upload
- [ ] 5.2 Add verification, twin-asset lifecycle, processor deletion, and actor-controlled pause/withdrawal
- [x] 5.3 Add actor library search/selection with only active, licensed twins
- [x] 5.4 Snapshot consent/licence per generation and attach the snapshot to provenance and delivered output
- [ ] 5.5 Add append-only actor-use earnings, reversals, dashboard balances, KYC/tax status, payout accounts, and payouts
- [x] 5.6 Test actor death/incapacity escalation, fraud invalidation, misuse reports, withdrawal, master deletion, and delivered-licence survival
- [ ] 5.7 Run the actor smoke: consent -> verify -> cast -> artifact/licence -> earning -> withdraw -> payout

## 6. Launch gates

- [ ] 6.1 Run the full unit/integration/concurrency/tenant-isolation suite
- [ ] 6.2 Prove target-host private artifact playback and one successful brand render with billing test mode
- [ ] 6.3 Prove one authorised YouTube or Instagram publish while retaining accepted/scheduled/confirm gates
- [x] 6.4 Keep actor feature flags off until all actor consent/licence/earning/payout gates pass
- [ ] 6.5 Update product copy and legal documents to expose only enabled capabilities
- [ ] 6.6 Update PROJECT_STATUS, archive the OpenSpec change, and obtain explicit approval before deploy or public launch
