# Product scoreboard

The owner requested a private quality scoreboard inside SaaS Maker, with six
category assessments and one next recommendation for every project/category.
It is a view of the authenticated Projects page:
`/projects?view=scoreboard`.

The public navigation links to that view. The public `/ranks` page continues
to show domain ratings; those ratings do not measure product quality.

## Assessment

The six categories are:

1. Product and feature parity: the core job, correctness and market alternatives.
2. Design and delight: comprehension, friction, preference and a memorable result.
3. SEO and growth: current pages, keyword/intent fit and useful organic arrivals.
4. GEO and AI visibility: mentions, recommendations and citations in real answers.
5. Measurement and learning: knowing what happened and what to do next.
6. Engineering and operations: dependable delivery, security and recovery.

Each applicable category has an estimate out of ten. Six known applicable
categories sum to a maximum of sixty. The board does not manufacture a complete
total when evidence is missing.

- **Unassessed** means unknown. It is not a zero.
- **Exempt** means an explicit scope exemption. It is excluded from the denominator.
- **Provisional** identifies a low-confidence best estimate, not a measured outcome.
- Confidence describes the evidence behind the estimate, not product quality.
- Every assessment includes reasoning and dated evidence or a dated evidence gap.
- Source revisions and limitations remain available beside each recommendation.

The initial review used a four-point rubric. Its estimates are multiplied by
2.5 without rerating them: the previous 3.5 target becomes 8.75/10. This is a
scale conversion, not additional measurement or newfound precision.

Read the scale as 5 = competitive, 7.5 = credibly among the best in the stated
segment, and 10 = demonstrated sustained leadership. Missing audit evidence
lowers confidence rather than automatically lowering quality. Internal tools
are judged against their intended task. Provisional GEO estimates must state
their basis and retain any missing answer-engine measurements explicitly;
readiness and historical captures cannot establish current recommendation share.
The coverage strip separates scored areas, provisional estimates, unassessed
areas and scope exemptions. It does not claim every numeric score was measured.

The October 22, 2026 private snapshot contains 39 current identities and 234
category recommendations: 216 actions and 18 internal acquisition exemptions.
That initial baseline left thirty-seven category scores unknown. Subsequent
private review imports can resolve them with dated, qualified estimates;
the UI computes current coverage from the imported data. Historical/retired identities
remain in the private review appendix rather than the current execution queue.
These are snapshot counts, not hardcoded application limits.

Internal tools are assessed for their intended usefulness and dependability.
They do not inherit public SEO or AI acquisition goals. The private review
policy records those exemptions separately from canonical lifecycle metadata.

## Design evidence

A design number alone cannot establish quality. Use observations from the
actual core workflow, including first comprehension, time to first value,
friction, errors, recovery, accessibility and moments of delight.

Compare alternatives using the same task and audience. Record what people
understood, where they hesitated, what they preferred and why. Landing-page
appearance does not prove the quality of an unseen application. Record the
scope, device and missing evidence rather than transferring a landing score.

## Opening the private review

1. Sign in to SaaS Maker and open Product scoreboard.
2. Choose **Import review** and select the owner-local `scoreboard-review.json`.
3. Review the snapshot label and counts before confirming a replacement.
4. Inspect a score to see its reasoning, source date and limitations.
5. Use the project, category, domain, scope and status filters to choose a focus.

The private baseline is not committed to this repository, embedded in a build,
retrieved from a server or loaded by the public directory. The interface can
open a validated JSON snapshot supplied by its user.

Browser storage is separated by signed-in account ID on that origin. Signing
in on another browser, profile, origin or device does not synchronize the
workspace. Development and production also have separate browser storage.

## The cadence

Keep one lever active across the whole workspace.

1. Inspect the biggest gap and its prerequisite actions.
2. Pick one bounded lever and read the evidence required to close it.
3. Make the change in the owning product's normal workflow.
4. Record what changed, the dated evidence and its exact scope. Use Save progress
   note before leaving unfinished work; it preserves the text without claiming
   an outcome.
5. Verify the observed outcome, wait for evidence, or park with a reason.
6. Pick the next ready lever, or queue a follow-up in the same category.

A lever cannot start until its declared prerequisite objectives are explicitly
accepted with a verified helpful outcome. Failed experiments do not unblock work;
queuing a follow-up does not erase earlier accepted proof. Critical
levers sort first; the suggested next lever is advisory, not an automatic
product change or instruction to deploy.

**Await evidence** is for delayed observation such as an organic-search window.
It frees the active slot and retains the note, but does not claim improvement.
Check waiting evidence at the next work session. Review the whole queue weekly.
There is no background schedule or notification attached to this view.

**Verify outcome** requires a result, evidence and observed outcome. Learning
that something did not help is a legitimate verified result. Verification
records the experiment; it does not automatically raise an assessment score.

**Park with reason** records why the work stopped. A parked lever may be resumed
or replaced by a more useful next action.

After verification or parking, **Plan the next lever in this area** replaces
the current recommendation. The previous plan, baseline score, transitions,
result, evidence and outcome remain in history. There remains one current
recommendation per project/category.

Only a new reviewed assessment changes scores. Preserve the previous snapshot
and describe the evidence behind any score change during that review.

## Durable progress and backup

Updates save to localStorage. If storage is unavailable or full, the interface
shows an unsaved warning and keeps the current tab's state available for export.
Export immediately before closing that tab.

Use **Export backup** after a review session and before clearing browser data,
switching devices or replacing a workspace. The JSON contains the snapshot,
current progress and append-only outcome history. Store it privately.

A new baseline import preserves history and matching progress by stable lever
ID, including follow-up plans. It refuses to remove an active lever: finish or
park that work first. An imported workspace backup replaces the workspace
after confirmation. Export the existing workspace before replacing it.

Tabs on the same origin receive persisted updates. Supported browsers use a
Web Lock to serialize writes and read the latest saved state before a change.
An unsaved tab warns rather than silently replacing its unexported work.

Focus links contain only selected IDs, category and domain, never assessment
text, evidence or history. A recipient needs their own imported workspace.
Local filesystem evidence paths display as text; only credential-free HTTP(S)
URLs are clickable.

## Privacy and boundaries

The scoreboard is authenticated and marked private/no-store. Its document omits
Clarity replay, blocks off-origin connections and disables frames and external
form submissions. Navigation into and out of the private view uses a document
load so a replay script from another page is not retained by client routing.

The same-origin application and browser profile are trusted. This is not
server-side storage, encryption, a backup service or a separate security origin.
The view does not modify products, deploy, create issues, send messages or
change App Health/analytics integrations. Operational evidence remains owned
by the relevant systems and is attached to a reviewed assessment when useful.

## Rebuilding the owner-local snapshot

The optional Node 24+ assembler reads an existing private review directory.
It never runs during a public build and refuses output inside this repository.

```bash
node scripts/create-scoreboard-review.mjs \
  --review-dir /absolute/path/to/private-review \
  --output /absolute/path/to/private-review/scoreboard-review.json
```

Its inputs are the existing active ratings, review manifest, scoreboard policy,
and the four recommendation batches. It checks complete category coverage,
unique stable IDs, dated evidence, score semantics, best-next references and
acyclic dependencies, then writes the import JSON and a complete Markdown
recommendation reference beside it. Private paths and source contents remain
in those owner-local outputs.

The policy records internal scope, target and each project's best next category.
The assembler converts only known scores and normalizes internal SEO/GEO to
explicit exemptions. Public product-scope decisions remain actionable so their
dependent work can progress after the decision is verified.

## Validation

The focused cadence tests cover score denominators, missing evidence, invalid
imports, prerequisites, one-active enforcement, verification requirements,
follow-up history and baseline refreshes. Middleware tests cover authentication,
private headers, cache/referrer policy and off-origin connection restrictions.
Rendered checks cover populated scores, evidence, filters, import, reload and
cadence transitions at desktop and phone widths.
