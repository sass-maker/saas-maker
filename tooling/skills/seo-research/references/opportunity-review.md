# Evidence to exact edit to measured outcome

## Context and data contract

Read existing product truth: audience, offer, target country/language, useful
conversion and approval boundaries. Inventory available authorized sources before
proposing work. Reuse existing context rather than demanding another intake file.

Keep observed searches, customer questions and generated keyword hypotheses
distinct and source-labelled. Group by buyer intent and map to existing URLs
before proposing new pages. One page should answer one main buyer question;
related questions need not each become a page. Link according to the next reader
need, not an article quota.

For Search Console evidence retain property, collection time, complete comparison
periods/timezone, filters, dimensions, aggregation, search surface, pagination,
returned-row count and known coverage limits. Use paired query–page rows for
query–page conclusions; separate top-query/top-page lists cannot establish pairs.
Create distinct click, impression and decline shortlists. Inspect query, intent,
position and comparable periods before recommending a rewrite.

The Search Analytics API returns click-sorted top rows and does not guarantee
complete coverage. Sorting a click-limited extract by impressions does not make
it the site's highest-impression list. Label it as a subset; pagination does not
erase upstream omissions. Fixed CTR benchmarks and potential-click arithmetic
are screening heuristics, not predicted gains.

Google documents a separate Generative AI performance report, with worldwide
rollout dated August 31, 2026. Do not confuse report existence with availability
through an integration. Verify the actual account, supported endpoint/export,
metrics, dates and failure semantics before claiming access. Preserve raw zero
versus missing-value meaning; if an export can encode unavailable values as zero
and ambiguity cannot be resolved, mark it unknown rather than measured absence.

## AI observations

Use a fixed versioned buyer-question set for repeat measurements. Every record
needs exact prompt, timestamp, engine, mode/surface, collection success, original
answer reference, mention observation and citation observation separately. Keep
missing/failed responses out of the observed-no-mention denominator. Disclose
coverage, geography/session context where known and answer variability.

Ordinary web search is not a ChatGPT recommendation measurement. Do not relabel
API answers as consumer-chat results or pool different surfaces silently. For a
competing citation record its exact URL and supported fact, then identify the
evidence our page lacks. Keep private answers in approved storage only.

## Decision and edit packet

Every candidate can end in `refresh`, `new_page`, `investigate` or `leave_alone`.
Explain buyer fit, evidence strength, effort and the missing fact that might
change the decision. If scoring helps a comparison, define the scale; scores
express judgment, never forecast traffic. A run need not generate new tasks.

For content, specify a useful addition, required sources/tests and what is a
documented capability versus a hands-on result. Leave unsupported claims blank.
Improve answer clarity, headings, tables and evidence placement only as needed.
No guaranteed rankings or mandatory special AI schema/files.

For a refresh record: problem, evidence, exact current passage, replacement,
source revision, reviewer, baseline, validation and rollback plan. For internal
links: source URL → surrounding sentence → anchor → destination URL; verify the
destination and intended canonical, distinguishing editorial links from navigation.

Suspected cannibalization requires paired query–page evidence across comparable
periods, intent review and actual performance conflict. Similar titles/keywords
alone do not justify merging. For technical findings use the existing seo-audit
workflow; retain URL, intended indexability, actual response and reproducible
failure, preserving intentional exclusions. Audit heuristics need interpretation,
not automatic production edits.

## Execution boundary and change history

Research authorization permits a proposed patch in the report, not production
mutation. Scope local edits and publication separately. A CMS draft flag is not
an access boundary: an update to an existing live post may publish immediately.
Do not test writes against production merely to establish read-only access.

Before any approved application: preserve original content/revision, confirm the
exact approved patch and target are still current, apply minimally and validate.
Read back saved content and, after authorized publication, inspect the live page.
Store proposed/approved/applied/published/live-verified states separately with
revision, URL and timestamps. Never attribute results to unshipped work.

Before integrating a write-capable backend, verify research credentials cannot
publish/delete/redirect/send, using documented scopes and an isolated authorized
test target. Test repeated requests, partial failure, duplicate prevention and
rollback. Following an uncertain write, inspect before retrying; do not re-create
content blindly. Approval covers a specific artifact/action, not blanket access.

Keep instructions independent of providers. Verify auth, entitlement, cost/quota,
history, exportability, metrics and failure behavior before using an integration;
do not inherit quoted plan prices, exchange requirements or default permissions.

Compare published changes against retained baselines with the same filters and
complete observation windows. Report useful conversions if actually available;
disclose seasonality, concurrent changes and attribution limits. End with a
justified next action, including waiting or leaving the page alone.

Acceptance: on an explicitly selected product and authorized scope, identify a
justified change (or leave alone), prepare an exact patch, verify any authorized
publication and report observations without inventing certainty. This guidance
does not establish that such a live trial has already passed.

## Sources and verification boundaries

User-supplied requirements adapted 2026-09-18. No unnamed platform repository,
paid plan or authenticated integration was tested. Primary references:
[Search Analytics API](https://developers.google.com/webmaster-tools/v1/searchanalytics/query),
[Generative AI report](https://support.google.com/webmasters/answer/16984139?hl=en),
[Google AI features](https://developers.google.com/search/docs/appearance/ai-features),
[spam policies](https://developers.google.com/search/docs/essentials/spam-policies).
Recheck evolving reporting capabilities when implementing an importer.
