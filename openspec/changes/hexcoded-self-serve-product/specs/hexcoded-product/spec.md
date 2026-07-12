# hexcoded-product

## ADDED Requirements

### Requirement: Authenticated workspace isolation
Every customer-owned record SHALL belong to a workspace, including campaigns,
briefs, render jobs, artifacts, social connections, and billing records. Every customer API and artifact
request SHALL authenticate the caller and authorise access through workspace
membership. Internal fleet automation SHALL use an explicit service identity
rather than bypassing tenant checks.

#### Scenario: Cross-workspace access is denied
- **WHEN** a member of workspace A requests a job or artifact owned by workspace B
- **THEN** the service returns a non-disclosing denial and records the denied access without exposing workspace B data

#### Scenario: Internal automation remains explicit
- **WHEN** the SaaS Maker integration submits an accepted internal marketing item
- **THEN** it acts through a scoped service identity and the existing approval state is preserved

### Requirement: Review-gated URL-to-ad workflow
A brand SHALL be able to submit a product URL and campaign inputs, review the
resulting brief and claims, accept the quoted credit cost, generate a video,
review the output, and download it. No customer output SHALL be published before
the output is explicitly accepted and the posting gate is satisfied.

#### Scenario: Brand produces a downloadable video
- **WHEN** an authorised workspace member accepts a valid URL-to-ad brief and has sufficient credits
- **THEN** the service holds the quoted credits, renders the accepted brief, exposes a private review artifact, and permits download after output acceptance

#### Scenario: Unaccepted brief cannot render
- **WHEN** a draft brief has not been accepted
- **THEN** render submission is rejected without holding or consuming credits

### Requirement: Idempotent credit settlement
Credits SHALL be represented by an append-only auditable ledger. A render SHALL
hold its quoted cost before dispatch, capture that hold at most once when the
defined successful output state is reached, and release it at most once on a
terminal technical failure. External billing events and render submissions
SHALL be idempotent.

#### Scenario: Successful render is charged once
- **WHEN** duplicate completion callbacks are received for one successful render
- **THEN** exactly one capture entry exists and the workspace balance reflects one charge

#### Scenario: Technical failure returns the hold
- **WHEN** all bounded attempts terminate for a technical failure before a usable output is delivered
- **THEN** the hold is released once and no capture entry is created

### Requirement: Durable and private execution
Customer render jobs SHALL use durable persisted state, bounded retries, worker
leases, and idempotent side effects. Customer artifacts SHALL be private by
default and available through authorised delivery. A render failure SHALL not
silently become a successful charge or published post.

#### Scenario: Worker lease expires
- **WHEN** a worker stops heartbeating during a render attempt
- **THEN** the attempt becomes recoverable after lease expiry and the job is retried within its configured bound without duplicate settlement

#### Scenario: Private artifact is requested anonymously
- **WHEN** an unauthenticated caller requests a private customer artifact
- **THEN** no artifact bytes or identifying metadata are returned

### Requirement: Output provenance and disclosure
Every delivered output SHALL have an immutable provenance and licence record
covering customer inputs, renderer/model/provider, source footage, music, voice,
actor use if any, review approvals, and the synthetic-content disclosure
decision. The export path SHALL support the labels or machine-readable metadata
required for the enabled launch jurisdictions and publishing platforms.

#### Scenario: Output provenance is inspected
- **WHEN** an authorised customer or operator inspects a delivered output
- **THEN** the exact source, provider, licence, actor, disclosure, and approval records used for that generation can be retrieved

#### Scenario: Required label is missing
- **WHEN** the disclosure policy requires a label or metadata that the selected export path cannot provide
- **THEN** delivery/publication is blocked with a reviewable reason

### Requirement: Versioned legal acceptance
The service SHALL record the accepted document, immutable version or content
hash, accepting subject, timestamp, and acceptance source for Terms, Privacy,
and Actor Licence agreements. A materially changed agreement SHALL require a
new acceptance before the affected operation proceeds.

#### Scenario: Actor licence changes materially
- **WHEN** an actor has accepted an older Actor Licence and a material new version applies to future generations
- **THEN** the twin cannot be newly cast until the actor accepts the new version

### Requirement: Consent-verified actor lifecycle
Real-actor casting SHALL remain disabled until an adult actor has accepted the
Actor Licence, passed the configured identity/liveness verification, and has an
active twin. Each generation SHALL snapshot the applicable consent and licence.
An actor SHALL be able to stop new uses without invalidating previously
delivered licences.

#### Scenario: Actor withdraws future use
- **WHEN** an actor withdraws or pauses an active twin
- **THEN** no new render can reserve or use the twin, while prior delivered outputs retain their immutable licence evidence

#### Scenario: Unverified twin is selected
- **WHEN** a brand attempts to cast a draft, verifying, paused, withdrawn, or rejected twin
- **THEN** the render is rejected before credit capture and no actor-use record is accrued

### Requirement: Purpose-bound biometric retention
Master face, voice, liveness, and verification assets SHALL have documented,
purpose-bound retention and processor-deletion behavior. Perpetual delivery
licences SHALL be proven through retained consent/licence records and output
provenance; they SHALL NOT by themselves require perpetual retention of reusable
master biometric recordings.

#### Scenario: Twin is withdrawn and master retention is no longer required
- **WHEN** the actor withdraws the twin and no documented operational or legal purpose requires a master asset
- **THEN** the service deletes the master and requests processor deletion while retaining the minimum consent/licence proof for delivered outputs

### Requirement: Auditable actor earnings and payouts
One chargeable successful real-actor use SHALL create exactly one append-only
earning entry under the rate shown at reservation time. Refunds or chargebacks
SHALL create explicit reversal entries. Actors SHALL be able to view accrued,
payable, paid, and reversed amounts and the status of KYC/tax and payouts.

#### Scenario: Actor use succeeds
- **WHEN** a paid brand render using an active actor reaches the chargeable successful state
- **THEN** exactly one actor-use and one earning entry are recorded using the reserved rate

#### Scenario: Brand charge is reversed
- **WHEN** the corresponding brand charge is refunded or charged back under the published policy
- **THEN** an explicit linked reversal is recorded without mutating the original earning entry

### Requirement: Accepted and authorised social publishing
Social publication SHALL require an accepted rendered output, an authorised
workspace social connection, a supported provider/channel, an eligible schedule,
and explicit execution confirmation. Provider failure SHALL retain the item for
operator review and SHALL NOT mark it posted.

#### Scenario: Posting provider fails
- **WHEN** an authorised publish job reaches the provider and the provider rejects or times out
- **THEN** the failure is classified and recorded, the output remains accepted but unposted, and no posted timestamp is written

### Requirement: Phased launch gates
Brand self-serve, billing, social publishing, and actor casting SHALL be
separately feature-gated. A capability SHALL NOT be presented as enabled until
its target-host acceptance evidence is current. Actor casting SHALL remain off
until consent, licence, earnings, withdrawal, retention, misuse, and payout
acceptance tests pass.

#### Scenario: Actor code exists but payout proof is missing
- **WHEN** actor onboarding and twin generation are implemented but the payout acceptance test is unresolved
- **THEN** real-actor casting remains disabled and customer-facing product copy does not offer it
