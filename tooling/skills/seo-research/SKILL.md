---
name: seo-research
description: Research keywords, search competitors, backlink prospects, and local-search opportunities with evidence and optional provider metrics; use for SEO market decisions, not technical on-page audits, Search Console collection, or content publication.
---

# SEO research

Develop an evidence-backed search opportunity recommendation without making a
paid provider or a single metric vendor authoritative. Route title, canonical,
sitemap, structured-data, crawl-error, and other technical checks to
`../seo-audit/SKILL.md` instead.

## Modes

- **Keyword opportunities:** demand, intent, current rankings, difficulty, and
  the page or product that could satisfy the query.
- **Competitive landscape:** competitors visible for the relevant search
  intent, the pages earning visibility, and defensible coverage gaps.
- **Link prospecting:** relevant public sites, why the relationship is
  plausible, and the evidence needed before outreach. Do not send outreach.
- **Local search:** service/location intent, visible local competitors, local
  result types, and profile/content gaps.

## Evidence order

1. Repository product truth and the target's live public pages.
2. First-party measured data already available through Site Health or Search
   Console.
3. Recent bounded cached evidence with its collection timestamp.
4. Current public SERPs and official competitor pages.
5. Optional OpenSEO metrics when its MCP is already connected and the user has
   authorized any credit-spending call.

Do not install or connect OpenSEO, request credentials, inspect environment
files, or create provider projects from this skill. If provider metrics are
needed but unavailable, continue with valid evidence and mark only those fields
`unavailable` with the exact reason.

OpenSEO is an optional measurement backend, not the workflow authority. When
available, its useful lanes are keyword research and metrics, ranked keywords,
SERP results, backlinks, competitor research, and local-search evidence. Check
the provider's current tool schema and price before calling; reuse recent
equivalent results when the provider exposes a research log or cache.

## Method

1. Define the product, market, audience, language/location, and decision this
   research must support.
2. For keyword work, start with first-party queries and pages when available,
   then widen to a small set of distinct seed themes.
3. Inspect actual result pages for high-priority terms so search intent, result
   type, and competitive fit are observed rather than guessed.
4. Remove irrelevant, duplicate, branded-only, and off-intent candidates.
5. Prioritize business and intent fit before raw volume. Treat volume,
   difficulty, CPC, authority, and backlink counts as provider estimates with a
   source and date.
6. For competitor work, separate direct product competitors from sites that
   merely rank for the same informational query.
7. For link prospects, verify topical relevance, the specific relationship or
   contribution path, and obvious quality concerns. Do not equate a large
   authority score with a good prospect.
8. Recommend the smallest useful next action and name what would change the
   decision.

## Evidence states

Label material evidence as:

- `measured`: returned by a named first-party or provider source now;
- `cached`: previously measured, with collection date;
- `observed`: verified on a current public page or result set;
- `inferred`: reasoned from observed evidence;
- `unavailable`: not accessible, with the exact reason.

Never convert unavailable metrics to zero or invent keyword volume, difficulty,
rank, backlinks, traffic, local-pack position, or provider access.

## Output and receipt

Lead with the recommended opportunity and why it matters. Include a compact
table appropriate to the mode, with source/date columns for quantitative
claims. Then report:

- scope, market, language/location, and observation date;
- sources and providers used;
- live, cached, inferred, and unavailable evidence;
- paid calls and reported cost, if any;
- the prioritized action, risks, and follow-up measurement.

Research does not authorize saving provider records, changing a site, sending
outreach, publishing content, or deploying anything.
