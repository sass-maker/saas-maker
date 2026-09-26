---
name: seo-sprint
description: >
  A multi-phase SEO sprint for one Fleet product: research real demand,
  draft a persistent roadmap doc, then execute it phase by phase — shipping
  alternative, comparison, use-case, and pillar pages with internal-linking
  and schema checks enforced before each phase ships. Use for "build organic
  traffic from scratch", "SEO sprint", "rank in Google", "programmatic SEO
  playbook", "competitor alternatives", "we need traffic" on a product with
  no existing roadmap. Distinct from seo (daily operator — picks the single
  best next action) and content-coverage (gap inventory, not a phased plan).
---

# seo-sprint — roadmap once, then execute phase by phase

Two modes; the user never names which:

- **Initialize** — no `docs/seo-sprint.md` (or equivalent roadmap) in the
  product repo: research demand, write the roadmap, start phase 1.
- **Resume** — roadmap exists: pick up the next pending phase (or the one the
  user names), execute it end to end, check it off.

## Initialize

1. **Product truth**: read the product's AGENTS.md, live site, and
   `saas-maker` catalog entry (`catalog/projects.json` →
   `projects[<id>].presentation`) so the roadmap sells what the product
   actually does.
2. **Demand research** via `skills/seo-research`: keyword clusters the
   product can honestly win — comparisons ("X vs", "alternative to"),
   use-cases ("<thing> for <audience>"), how-tos it genuinely answers,
   pillar topics. Ahrefs metrics if configured; mark estimated demand
   honestly when not.
3. **Current position**: `node saas-maker/tooling/scripts/seo-scoreboard.mjs
   scoreboard --project <id> --format json` — what's indexed, what's already
   earning impressions, what the queries are.
4. **Write `docs/seo-sprint.md`** in the product repo: phased roadmap —
   each phase = a page set (e.g. 5 alternatives, 3 use-cases, 1 pillar),
   target queries, internal-link plan, done/ pending checkboxes, and the
   evidence each phase is justified by. Commit-style: a document the owner
   can veto.

## Resume / execute a phase

For each page in the phase, follow `skills/seo-content`'s writing bar
(information gain, real voice, honest claims) — but faster: sprint pages are
programmatic-shaped templates, so build the page template once and keep
quality gates:

- Before the phase ships: title/meta/OG present, canonical correct, schema
  (FAQPage only if truly a FAQ — deprecated elsewhere; Article/WebPage as
  fits), internal links in *and* out, `seo-audit` pass on one sample page.
- After: submit all new URLs via `pnpm --dir site-health indexing submit
  --project <id> --url <u>`, register the phase with
  `seo-scoreboard.mjs register --lane programmatic`, and tick the roadmap.

## Hard rules

- Never ship a comparison page for a competitor the product doesn't beat on
  the claimed axis — the roadmap lives or dies on honesty.
- One phase per run unless the user says otherwise; the doc is the state.
- If the fleet catalog's `presentation.directory` metadata changes as a
  result of shipped pages, update `catalog/projects.json` and run
  `pnpm catalog:sync-public` in the same task.
