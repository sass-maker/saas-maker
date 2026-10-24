---
name: agentic-seo
description: Run an owner-scoped search and AI growth cycle for a Fleet product, from researched opportunities and briefs through writing, QA, publication evidence, conversion measurement and refreshes. Use for agentic SEO setup, recurring content operations, FirstIndex-style workflows or checking their readiness.
metadata:
  author: Fleet
  provenance: Owner-supplied BuildingWaves article dated 2026-10-19 and FirstIndex public service workflow reviewed 2026-10-24; Fleet-authored implementation, not their original skill files or software.
---

# Agentic SEO

Operate one named product's existing content workflow. MentionPilot was absorbed
into **Site Health → AI Awareness**; do not revive it or create another SEO app.
SaaS Maker owns this reusable skill; Site Health owns private evidence and growth
state; delivery issues and code stay in the product's repository.

## Readiness

Read the product truth, audience, existing pages, current task queue and useful
conversion (signup, activation, purchase or another owner-defined event). Check
connections as `verified`, `configured-unverified`, `missing` or `not-needed`.
Availability of a tool, skill or config file does not prove account access.

- **Website/blog:** identify the owning repo, content model, drafts, preview,
  publication and rollback paths. Do not implicitly create a blog or CMS.
- **Search/AI evidence:** Site Health owns collectors. Read current receipts and
  coverage. Search Console refresh: from its checkout,
  `node apps/backend/scripts/search-console-collect.mjs --project <id>`.
  Do not append `--discovery-cycle`: it also submits sitemap/indexing changes.
  API-model answers, consumer-assistant captures and ordinary SERPs are separate
  evidence channels. Failed/unavailable answers are unknown, not missing mentions.
- **SERPs/backlinks:** use `seo-research` and existing authorized providers.
  Ahrefs, OpenSEO and DataForSEO are alternatives, not required subscriptions.
  Establish metered-call limits before spending; research can proceed without
  paid volume estimates. Never inspect secrets or environment files.
- **Analytics:** verify the actual conversion event, landing-page attribution,
  property, filters, dates and denominator. Clarity sessions do not prove revenue.
- **Execution:** reuse the owning repo's GitHub Issues (Vault retains Linear),
  browser/screenshot tools and scheduler. Setup alone does not authorize a new
  unattended schedule or article campaign. Respect existing authorization;
  do not ask again for actions already within it.

## One cycle

1. Review existing URLs, prior changes, awaiting observations and open delivery
   issues. Start with technical/indexing defects when they explain the loss.
   Stay within the owner's product scope and current improvement lever.
2. Research buyer questions, keywords, actual SERPs and competitors. Group intent
   and map it to existing URLs before proposing new pages. Prefer conversion
   proximity and product fit over unsupported volume. No new work is a valid
   result when the evidence favors waiting or leaving a page alone.
3. Write a sourced brief: audience, intent/query cluster, target URL, new/refresh/
   merge rationale, baseline or unavailable state, differentiation, outline or
   exact fix, claim ledger, internal links, image plan, CTA/event, acceptance
   checks and next observation window. Deduplicate intent against existing work.
4. Draft the appropriate article, honest comparison, useful free tool or page
   fix in the owning repo. Verify brand features/pricing, crawl access, canonicals,
   rendering, titles, links and CTA paths where relevant. Preserve a preview.
5. Run a separate reviewer using [content QA](references/content-qa.md).
   Fix specific failures and recheck the changed draft. Default to at most two
   revisions, then park unresolved evidence/access gaps. Do not weaken QA to ship.
6. Publish through the existing authorized path with prior revision/rollback
   preserved. Read back the canonical live page, metadata, links, images and CTA.
   Inspect before retrying an uncertain write. A merged PR is not a publication
   receipt; publication is not proof of indexing, recommendations or growth.
7. Compare complete, comparable periods with property, market, filters, lag and
   coverage retained. Keep search clicks, AI mentions/citations, visits and useful
   conversions distinct. Investigate tracking failure before declaring no demand.
   Refresh only when evidence warrants it; preserve unknowns and causal limits.

## Site Health operating path

Use a current Site Health checkout containing the CLI. If the default
`~/Desktop/fleet/site-health` is behind with dirty work, preserve it; inspect
`git worktree list --porcelain` for a verified current checkout. In worktrees,
pass growth commands `--registry ~/Desktop/fleet/saas-maker/catalog/generated/operations.json`
when their relative catalog link is unavailable. Never use a synthetic registry
for real work. Read `apps/backend/docs/growth-cycle.md` for JSON inputs and
`apps/backend/docs/ai-visibility-operations.md` for collection. Keep raw data private.

```sh
node apps/backend/scripts/brand-evidence.mjs profile <project> --input /private/profile.json
node apps/backend/scripts/growth-cycle.mjs view <project>
node apps/backend/scripts/growth-cycle.mjs apply <project> --input /private/change.json
```

Every change contains the current `revision` and `command`. `plan` records this
UTC week without duplicate unresolved work; it makes no provider calls. `add`
requires a qualified kind, intent, mapped URL, brief, baseline and source evidence.
Use `brief` to update existing unpublished task instructions, baseline, sources
and issue link without duplicating its intent; this invalidates QA. Reload on
conflicts, inspect the existing state, then decide whether to retry.

`draft` returns a SHA-256 digest. `review` must name a different reviewer, the
current digest and all six checks: readability, originality, SEO, claims, images,
CTA, each with `passed` and a specific note. Any draft edit invalidates review.
`publish` only records a supplied live receipt after real publication; it does
not deploy, submit indexing, post socially or send outreach. Store `revision` is an integer; the published source revision string belongs
in `receipt.revision`. Content receipts must match the mapped URL. Work then awaits evidence, not a success claim.
`measure` requires a complete post-publication window, source attribution and at
least one real count; null means unavailable, zero means observed zero. AI
mentions need an answer denominator and channel. Published refreshes cite
`refreshOf` and keep the URL; a sourced urgent fix need not wait for traffic data; `complete` is for sourced research/check/report work only. `park`
retains a reason. Delivery stays in product issues; this store is the evidence loop.

For third-party best-tools listicles use the installed `ai-listicle-outreach`
skill: observed AI competitors → authorized backlink evidence → relevant
publishers → reviewed pitch. Directory/social distribution likewise requires
relevance and truthful claims. Sending messages requires an explicit instruction;
editorial placement never guarantees an AI recommendation.

For an authorized weekly run, review due outcomes before researching a bounded
next batch. Record owner feedback in existing product context or issues; do not
rewrite the skill or its permissions as autonomous “self-improvement.” Finish
with actions, QA, source revision/live URL, observed outcomes, gaps and next check.
Do not promise rankings, endless keywords, a three-month payoff or revenue.

## Sources

Owner-pasted Kourosh Ghaffari / @BuildingWaves article, 2026-10-19 (original linked
skills and revenue claims unverified); [FirstIndex](https://firstindex.com/)
(service inspiration, no affiliation or installed integration);
[Google AI content guidance](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content).
