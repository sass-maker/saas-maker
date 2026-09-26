---
name: seo-content
description: >
  A self-deciding content engine for a Fleet product: researches what to
  publish next, picks the content type (guide, how-to, listicle, comparison,
  definition, data study, opinion, case study), and ships one
  deeply-researched, on-brand piece with real information gain. Use for
  "write the next piece", "what should I publish next", "feed the blog",
  "next content", "create a new article" for a product site. Distinct from
  content-coverage (inventories intent gaps and missing pages — use it for
  WHAT exists vs what's missing) and seo (the daily operator that ranks
  content against every other move).
---

# seo-content — decide → research → write → verify → register

One publishable piece per invocation. The skill's job is deciding *what* and
*which type*, not just writing.

## Step 1 — Ground in the product

- Read the product's AGENTS.md + its content dir. Find the brand/voice doc;
  if none exists, infer voice from the three most recent published pieces and
  note that inference.
- Load what already exists: list every published piece (paths + titles) —
  dedupe is your responsibility.
- Load evidence, in order of value:
  - `node saas-maker/tooling/scripts/seo-scoreboard.mjs scoreboard --project
    <id> --format json` — the queries Google already serves you (striking-
    distance terms are the cheapest wins).
  - `skills/content-coverage` outputs if a coverage audit exists for the
    product.
  - `skills/seo-research` for keyword/competitor pulls when the question is
    "is there demand", not "what did we already earn".

## Step 2 — Decide the piece

Pick the candidate with the best evidence: a striking-distance query cluster
(pos 4–20, real impressions), a stated coverage gap, or a competitor page
the product genuinely beats. Choose the type honestly — comparison/alternative
only when the product truly competes; how-to only when the product does the
thing; data study only with real data.

The bar: **information gain** — the piece must contain something that isn't
already on page 1 for that query (the product's own data, a real opinion, a
worked example). If nothing clears the bar, say so and stop — that is a
successful run.

## Step 3 — Write

- In the product's voice and conventions (frontmatter, directory, internal-
  link style — match neighboring pieces exactly).
- Draft → run the `humanizer` skill's tell list over it → fix.
- One canonical title, real H2s that answer the query, no SEO stuffing, honest
  claims only — never claim a capability the product lacks.
- Internal links to 2–4 related product pages/pieces that genuinely help.

## Step 4 — Verify + register

- Build/serve the site and confirm the page renders; check title/meta/OG.
- Submit for indexing: `pnpm --dir site-health indexing submit --url <url>`.
- Register: `node saas-maker/tooling/scripts/seo-scoreboard.mjs register
  --project <id> --lane editorial --summary "published <slug> targeting
  <query>" --target <url>`.
- If the product repo is git-managed, leave the change uncommitted for review
  unless the user asked to ship.
