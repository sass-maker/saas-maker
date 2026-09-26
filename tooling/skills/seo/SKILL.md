---
name: seo
description: >
  Fleet organic-traffic operator. Each run measures every product's search
  vitals from the local ledgers (Search Console impressions/clicks/position,
  per-URL indexing state, cached Clarity humans), ranks all candidate actions
  on one scale, executes the single best one through the owning subskill,
  verifies it, and registers it so later runs can score what worked. Use for
  "what should I do for SEO", daily organic ops, "why don't we rank", traffic,
  rankings, indexing follow-through, or the next best growth move.
---

# seo — fleet organic operator

Inspired by the daily-operator pattern: **measure → select → execute one →
verify → register**. Runs against the Fleet portfolio, not one repo. A run
that ends in "nothing beats the bar today" is a success — say so.

## The loop

1. **Measure.** Run from the Fleet root:

   ```bash
   node saas-maker/tooling/scripts/seo-scoreboard.mjs scoreboard
   node saas-maker/tooling/scripts/seo-scoreboard.mjs scoreboard --project <id> --format json
   ```

   The scoreboard is credential-free: it reads `~/.fleet` ledgers that
   site-health collectors maintain — Search Console 28-day
   impressions/clicks/CTR/position plus per-term detail, indexing request
   lifecycle counts, and the cached Clarity snapshot (human vs bot). If a
   panel is older than ~7 days and the question needs fresh numbers, say so
   and run the owning collector (`search-console-collect.mjs`,
   `indexing-requests.mjs check`, `clarity status-all`) before ranking.

2. **Select.** The scoreboard emits ranked candidates per product. Pick the
   highest-scoring candidate you can actually execute this run — a lower
   candidate you can finish beats a higher one you cannot. One product, one
   action per run.

3. **Execute through the owning lane:**

   | Lane | Route to |
   |---|---|
   | `fix` / `technical` | `skills/seo-audit/SKILL.md` on the affected URLs; fixes land in the owning repo |
   | `refresh` | `node saas-maker/tooling/scripts/seo-query-align.mjs [--project <id>]` finds pages whose title/H1 don't match the queries Google ranks them for; fix in the owning repo |
   | `editorial` / `programmatic` | `skills/content-coverage/SKILL.md` |
   | `indexing` | `skills/search-indexing/SKILL.md` (`pnpm --dir site-health indexing …`) |
   | `brand` | `node saas-maker/tooling/scripts/seo-brand-check.mjs [--project <id>]` audits every property's homepage for the brand-binding floor: brand-first `<title>`, brand in h1/hero/description, `WebSite` + entity (`Organization`/`Person`/`SoftwareApplication`) JSON-LD carrying the brand name, canonical. Owning your own name precedes split-word and category wins. |
   | `aeo` | `skills/agent-ready/SKILL.md` |
   | `distribute` / `offpage` | `skills/marketing/SKILL.md` |
   | `measure` | Repair the collector wiring itself (catalog domain, Clarity token, GSC property) |

4. **Verify.** Non-waivable. Re-read the changed evidence: the deployed page,
   the inspection verdict, the audit re-run. No verify, no register.

5. **Register.** Always — including measure-only runs:

   ```bash
   node saas-maker/tooling/scripts/seo-scoreboard.mjs register \
     --project <id> --lane <lane> --summary "what changed and where" \
     [--target <url>]
   ```

   Registered actions reappear on later scoreboards with impressions/clicks
   then-vs-now, so a month of runs shows which moves actually worked.

## Hard rules

- Never invent a number. Every claim cites the scoreboard, an inspection
  verdict, or a collector output.
- Do not resubmit or re-inspect URLs just to look busy — the indexing ledger
  dedupes open requests; respect it.
- Pages Google reports as `not-indexed` are a Google decision; fix the cause
  (coverageState verbatim is the evidence), never re-report it as fixed
  without a fresh PASS.
- Product source changes go in the owning repo; catalog/presentation changes
  follow the SaaS Maker catalog rules.
