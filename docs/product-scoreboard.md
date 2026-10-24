# Product scoreboard

The owner requested a private quality scoreboard inside SaaS Maker, with six
category assessments and one next recommendation for every project/category.
It is a view of the authenticated Projects page:
`/projects?view=scoreboard`.

The public navigation links to that view. The public `/ranks` page continues
to show domain ratings; those ratings do not measure product quality.

## Assessment

The six categories are:

1. **Product & feature parity**: among the best in its segment at the core job,
   with expected features and outcomes.
2. **Design & delight**: an aha moment, clarity and joy in the actual workflow.
3. **SEO & growth**: current pages, keyword/intent matching and growing daily
   organic arrivals.
4. **GEO & AI visibility**: prominent recommendations and citations when people
   ask relevant questions.
5. **Measurement & learning**: knowing what happened, what worked and what to do next.
6. **Engineering & operations**: dependable delivery, correctness, security,
   recovery and operation.

Each applicable category has two independent readings out of ten:

- **Effort**: the quality and completeness of relevant work executed against
  the checklist. Hours, spend and the mere presence of tools do not earn points.
- **Result**: the observed outcome against that category’s goal. Product results
  concern the core job; SEO results concern actual search arrivals/growth; GEO
  results concern captured recommendations/citations. Internal tools keep their
  intended-use scope.

Effort and Result each have a separate total out of sixty. They are never
blended into one grade or added into a score out of 120. Missing readings stay
explicit, and incomplete totals contain only known points.

- **Unassessed** means unknown. It is not a zero.
- **Exempt** means an explicit scope exemption. It is excluded from the denominator.
- **Provisional** identifies a low-confidence best estimate, not a measured outcome.
- Confidence describes the evidence behind the estimate, not product quality.
- Every assessment includes reasoning and dated evidence or a dated evidence gap.
- Source revisions and limitations remain available beside each recommendation.

AI and agent readiness is cross-category Product, Engineering and Measurement
evidence, not GEO visibility or a seventh score. The [canonical checklist](../tooling/docs/new-project-checklist.md)
defines applicability and shipped-runtime proof; interface presence or source
fixtures alone do not establish readiness or change a score.

The private usage view tracks rolling 30-day audience proxies, meaningful core
actions and dated owner reports separately. Audience alone is not use; qualified
inactivity prompts owner closure review without changing a score or archiving a product.

The initial combined review used a four-point rubric, converted by multiplying
by 2.5. Those original estimates remain in history as **Previous combined
score**. They are never automatically relabelled as effort or result proof.
The separate readings are independently reviewed against retained dated evidence;
missing outcome evidence is not zero or a penalty for missing telemetry.

For Result, 5 = competitive, 7.5 = credibly among the best in the stated
segment, and 10 = demonstrated sustained leadership. Effort uses 2.5 = basic
setup, 5 = material but incomplete checklist work, 7.5 = well-executed near-complete
work, and 10 = sustained best-in-segment execution. Missing audit evidence
lowers confidence rather than automatically lowering quality. Internal tools
are judged against their intended task. Provisional GEO estimates must state
their basis and retain any missing answer-engine measurements explicitly;
readiness and historical captures cannot establish current recommendation share.
The Review & backup sheet separates scored areas, provisional estimates,
unassessed areas and scope exemptions. It does not claim every numeric score was measured.

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
4. Compare Effort and Result in paired columns under each category. Each reading
   has its own sortable header, including both Total columns. Repeated clicks
   alternate ascending and descending. Total sorts the displayed known points,
   including clearly marked partial totals; entirely unassessed or exempt totals
   remain last. A partial total is never extrapolated to sixty.
5. Click a product row or its name for that product's information page: owner
   purposes, priority, scope, six score pairs and the best next lever. Click a
   score for its evidence sheet; score buttons do not navigate away. The next
   task in each area opens its change, finish line, full plan and prerequisites.
6. Use search, area, domain, scope and status filters to choose a focus. Focus
   links can also narrow to one product. Choose **Next levers** to browse actions
   or **History** for dated score comparisons, evidence and lever outcomes.

The report shows all matching rows on one page, with normal page scrolling.
There is no pagination or nested table scroll. Search, filters and sorting work
across the complete set. The inline scoring guide explains the rubric, partial
totals, confidence, internal exemptions and weekly review process.

`purposeCategories` is optional imported owner metadata using the canonical
catalog's three non-exclusive labels. Learning/skill and commercial/attention
bets receive **Focus** priority, ahead of **Standard** products whose only
recorded purpose is personal use. Unclassified
older imports remain explicitly unclassified. This priority is separate from
quality scores, maturity, revenue and individual lever urgency. It is the
default product ordering; the Priority header reverses it like every numeric
header. Purpose filters the three owner-intent labels; the separate Priority
filter selects Focus, Standard or Unclassified. The private catalog is never
bundled into the application.

The owner reset the working reports to one baseline on 23 October 2026. Older
review exports remain in a recoverable local archive; they are not active
scoreboard assessments. From this baseline, finish selected tasks and record
work, observed outcomes and evidence before the weekly report update. Reassess
only affected readings. Deferred participant checks and observation windows
stay explicit tasks. Weekly reports retain subsequent dated comparisons; this
cadence is not an automatic rating increase or a newly installed scheduler.
7. Open **Review & backup** for coverage, scale, private import and export.

The approved portfolio sheet uses a light working surface below the dark brand
header and the full available page width. Category names group Effort and Result,
displayed as plain numbers. Lever details open in a
sheet when selected, rather than squeezing the table into a side panel. There
is no nested table scroll area. The page scrolls normally and shows all matches
without pagination.
At phone and tablet widths, rows reflow into labelled cards, with explicit sort
and direction controls. No sideways scroll is needed in Scores, Next levers or
History. Full category names remain visible.

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
4. Record **Effort · work completed** separately from **Result · what actually
   happened**, with dated evidence and scope. Save progress before leaving.
   Work can be recorded while the result remains awaiting observation.
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

**Verify outcome** requires a separate observed result, evidence and outcome.
A deployment receipt or completed checklist alone cannot satisfy that result. Learning
that something did not help is a legitimate verified result. Verification
records the experiment; it does not automatically raise an assessment score.

**Park with reason** records why the work stopped. A parked lever may be resumed
or replaced by a more useful next action.

After verification or parking, **Plan the next lever in this area** replaces
the current recommendation. The previous plan, baseline score, transitions,
result, evidence and outcome remain in history. There remains one current
recommendation per project/category.

Only a new reviewed assessment changes scores. Every imported review retains
its scores, reasoning, confidence, dated evidence, source revisions and limits.
Lever transitions and follow-up plans do not create score versions.

## Score history

Use **Change since** on the score table to choose a retained baseline. Category
cells show independent Effort and Result changes. Numeric differences appear
beside their reading; newly assessed values are marked New. The default baseline
is the most recent retained prior assessment. **History** compares any
two assessments, with product search, category, domain and scope filters. Its
score-view selector separates Effort, Result and the previous combined rubric.
Older combined reviews cannot establish separate effort/result baselines; their
first separate ratings are newly assessed, not numerical improvements. Click a
change to inspect the full before/after evidence. Unchanged scores can be shown.

A numeric increase is an assessment change; it can reflect shipped work or a
correction to the evidence. The interface does not claim causation. Unknown to
known is labelled **Newly assessed**, with no numeric gain. Scope changes and
exemptions have no numeric delta. Evidence-only revisions remain inspectable.
One baseline is explicitly insufficient to establish a trend.

Use **Add to score history only** in the import dialog to retain an older review
without replacing current scores, active progress or lever outcomes. Reimporting
an identical assessment does not duplicate it. A fresh baseline import preserves
all previous assessments automatically. Retained assessments list their review
date, retention date and note; dates alone do not prove product improvement.

## Durable progress and backup

Updates save to account-scoped IndexedDB, allowing evidence history to grow
beyond localStorage's small quota. Existing localStorage workspaces migrate on
load, retaining the legacy copy for recovery. If storage is unavailable or full, the interface
shows an unsaved warning and keeps the current tab's state available for export.
Export immediately before closing that tab.

Use **Export backup** after a review session and before clearing browser data,
switching devices or replacing a workspace. The JSON contains the snapshot,
current progress, both effort/result readings and their evidence, retained score
assessments, and append-only work/outcome history.
Legacy backups remain importable. Imports are limited to 64 MB. Store backups privately.

A new baseline import preserves history and matching progress by stable lever
ID, including follow-up plans. It refuses to remove an active lever: finish or
park that work first. An imported workspace backup replaces the workspace
after confirmation. Export the existing workspace before replacing it.

Tabs on the same origin receive persisted updates through BroadcastChannel and
a localStorage invalidation token containing no review data. An older app tab
changing the legacy copy triggers a reconciliation warning. Supported browsers use a
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
follow-up history, independent effort/result totals and histories, separate
work/outcome notes, baseline refreshes, assessment retention, legacy migration,
evidence comparisons and safe history-only imports. Middleware tests cover authentication,
private headers, cache/referrer policy and off-origin connection restrictions.
Rendered checks cover populated scores, evidence, filters, import, reload and
cadence transitions at desktop and phone widths.
