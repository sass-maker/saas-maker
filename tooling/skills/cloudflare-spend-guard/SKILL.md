---
name: cloudflare-spend-guard
description: Audit Cloudflare costs, billable usage, free-tier or paid-plan exposure, quota exhaustion, project necessity, and safe optimization opportunities for Fleet. Use when the user asks whether Cloudflare is charging them, how likely a project is to cost real money, what is driving a bill, whether current Workers/Pages/D1/R2/KV/Queues/Durable Objects/AI usage is needed, which resources look wasteful, what can be optimized, or how to prevent surprise cloud spend.
---

# Cloudflare Spend Guard

Answer the money question first, then explain which usage is necessary and what
can be optimized. Compose current provider evidence with Fleet's project
inventory; do not infer a bill or a quota state from configuration alone.

## Provider companion

For Cloudflare, load the installed official `cloudflare` skill before
querying the provider. Follow its retrieval-first rule for pricing, limits,
changelog entries, API schemas, and product analytics.

Read the provider reference needed for the scope:

- [references/evidence-playbook.md](references/evidence-playbook.md) for
  Cloudflare.

For the optional recurring Fleet run, also read
[references/recurring-run.md](references/recurring-run.md). The checked-in
weekly job is disabled by default and must not be activated or installed unless
the operator explicitly asks.

## Safety boundary

Keep the audit read-only.

- Do not deploy, delete, pause, migrate, resize, query application data, or
  change a Cloudflare resource.
- Do not change a subscription, payment method, budget alert, usage limit,
  overage setting, plan, credential, DNS record, route, schema, index, group,
  location, or production config.
- Do not read token files, print environment values, or request payment-profile
  data. Prefer authenticated provider tools and CLIs that keep credentials
  hidden.
- Do not persist raw billing responses by default. Report only the aggregates
  needed for the decision.
- Treat every proposed mutation as a separate task requiring explicit approval.

## Choose scope

Use the narrowest mode that answers the request:

- **Project:** one Fleet project or provider resource.
- **Fleet:** all registered Cloudflare-backed projects plus unowned
  live resources.
- **Decision:** compare a specific cost driver or optimization.

Default to Cloudflare's current billing/reset period. State exact dates and
timezone. Use a comparison period only when it distinguishes a spike from a
steady baseline.

## Workflow

### 1. Establish local purpose and exposure

For Fleet-wide work, read:

1. `/Users/sarthak/Desktop/fleet/AGENTS.md`
2. `/Users/sarthak/Desktop/fleet/PROJECT_STATUS.md`
3. `site-health/apps/backend/config/projects.json`
4. the scoped project's `PROJECT_STATUS.md`

Run the configuration scanner:

```bash
node skills/cloudflare-spend-guard/scripts/scan-cost-surfaces.mjs --root /Users/sarthak/Desktop/fleet --json
node skills/cloudflare-spend-guard/scripts/scan-cost-surfaces.mjs --root /Users/sarthak/Desktop/fleet --project high-signal --json
```

The scanner reports **exposure only**. A binding, cron, package dependency,
example variable, database, or bucket proves configuration, not usage or cost.

Reuse the latest Cloudflare resilience report when it is current enough for the
question. Do not rerun broad live checks only to answer a narrow cost question.

### 2. Retrieve current provider rules

Before quoting any price, allowance, threshold, projection, or saving:

1. Retrieve current pricing, quota, usage, and billing documentation for every
   product in scope.
2. Search the changelog and current OpenAPI schema before calling billing
   endpoints.

If current documentation is unavailable, continue the exposure inventory but
do not quote monetary estimates.

### 3. Gather money evidence

Keep these separate:

- **Fixed:** Workers Paid or other recurring account/zone subscriptions and
  committed plans.
- **Usage-based:** invoice-aligned current-cycle billable usage and overages.
- **Credits/adjustments:** report separately when present.

Prefer the provider's invoice-aligned Billable Usage surface for usage costs.
It may exclude fixed subscription fees. Retrieve subscriptions or invoice
history separately when permitted.

If billing or plan access is missing or restricted:

- stop retrying that surface;
- mark the monetary result `unknown`, never `$0`;
- give the exact provider dashboard or CLI handoff from the relevant reference;
- continue with runtime and configuration evidence.

If a user supplies a screenshot or export, inspect only the billing period,
product, usage, billable usage, and cost fields needed for the audit. Avoid
payment details.

Normalize FOCUS-style usage JSON when useful:

```bash
node skills/cloudflare-spend-guard/scripts/normalize-billable-usage.mjs --input /path/to/sanitized-usage.json
```

The normalizer never calls Cloudflare. Missing cost fields stay missing.

### 4. Gather runtime evidence and attribute it

Use the shortest provider query that covers the observed products. Attribute by
exact script, zone, bucket, namespace, queue, workflow, index,
or other resource identifier.

Do not allocate shared account-level cost proportionally from request counts.
If the billing record lacks a unique mapping key, keep it account-level.

Use runtime evidence to answer:

- Which resource is consuming the billable dimension?
- Is usage stable, growing, spiky, or dormant?
- Is storage retained while requests are near zero?
- Are cron, queue, Workflow, or retry paths doing duplicate or avoidable work?
- Is an AI/media request cached, batched, bounded, and required by the product?

### 5. Judge necessity independently from cost

Read current product status before recommending cleanup.

Classify each row:

- `keep`: supports a shipped or planned requirement and is reasonably sized.
- `optimize`: needed, but evidence shows avoidable compute, operations, storage,
  duplicate work, or an avoidable paid plan.
- `pause-candidate`: cost-bearing or materially exposed, with no current owner
  or product requirement. List verification required before any action.
- `insufficient-evidence`: purpose, attribution, or runtime evidence is missing.

Low traffic alone does not make an active product waste. Non-zero cost alone
does not justify migration. Prefer the simplest system when supported savings
are negligible.

### 6. Assign spend state and exposure risk

Use one state per auditable account/product/project:

- `paying-now`: a fixed fee or positive provider cost is confirmed.
- `likely-this-cycle`: current-cycle usage plus current pricing establishes a
  credible path to overage or other monetary usage.
- `watch`: current plan and monetary evidence are available enough to rule out
  a current charge, while growth or an announced billing change creates a
  credible future charge.
- `unlikely-on-current-evidence`: plan, reset period, usage, and current
  allowance are known and remain comfortably within a fail-closed or included
  boundary.
- `unknown`: consequential billing, plan, usage, or attribution evidence is
  unavailable.

When spend state is `unknown`, keep it `unknown` even if configured exposure is
concerning. Record exposure risk separately:

- `low`: bounded or fail-closed exposure with no material growth signal.
- `watch`: a metered surface, retained storage, growth, or future billing change
  needs monitoring.
- `high`: unbounded or runaway-capable work has direct evidence and could create
  material spend, or fail-closed quota pressure can imminently block a needed
  product.

Always include confidence (`high`, `medium`, or `low`) and evidence age. Do not
use exposure risk as a substitute for monetary evidence.

## Calculation rules

- Use Cloudflare's billing/reset cycle.
- Keep fixed fees, usage charges, credits, and taxes separate.
- Never convert missing, null, restricted, or stale cost data to zero.
- Never add incompatible usage units.
- Project future spend only when plan, included allowance, price, elapsed
  complete days, and current-cycle usage are known. Show the inputs.
- Treat free-tier and paid-plan behavior separately; verify whether excess
  usage fails closed or becomes billable.
- Show savings as a range only when current usage and current pricing support
  it. Otherwise state the operational improvement without a dollar claim.

## Output

Lead with:

1. **Overall:** spend state, confirmed fixed fees, confirmed usage charges,
   likely next charge, confidence, billing period.
2. **Decision table:**

| Project/resource | Spend state | Exposure risk | Evidence | Needed? | Decision | Best next step |
|---|---|---|---|---|---|---|

3. **Optimization queue:** highest supported saving or risk first, with exact
   resource, trade-off, and verification step.
4. **Evidence gaps:** only gaps that could change a decision, with the smallest
   exact action needed.
5. **Safety:** confirm that no Cloudflare or production mutation occurred.

Keep confirmed charges distinct from estimates and configuration exposure.

## Recurring mode

Use recurring mode only for the registered weekly Fleet job or an explicit
manual dry run.

- Record sanitized aggregates through
  `scripts/record-spend-snapshot.mjs`; never edit its ledger or projections.
- Leave missing monetary evidence `unknown`.
- Page only when the recorder returns `warning` or `critical`. Routine
  successful `ok` runs remain notification history only.
- Do not expand the cadence beyond weekly without evidence that a faster-moving
  risk is being missed.
- Do not activate the disabled cron entry as part of a skill audit or test.
