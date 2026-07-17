---
name: geo-observatory
description: >
  Subskill of site-health — recurring GEO/SEO outcome measurement: probe
  configured queries on live web search, classify A/B/C, append to the
  ledger, regenerate the trend report. Route here from site-health for
  "did results move" and scheduled weekly runs.
---

# geo-observatory — fleet GEO outcome measurement

Subskill of `site-health` — invoked directly, via the parent router, or by the weekly routine.

You are recording **comparable, evidence-backed observations over time**.
Discipline matters more than cleverness: run the configured queries exactly,
classify coarsely, record honestly.

## Protocol

1. **Load config**: `fleet-ops/config/geo-observatory.json`. Never rephrase
   an existing query (`qid` history breaks); to track something new, ADD a
   query with a new qid and note it in the commit.
2. **Probe**: for each product's queries, run live web search (WebSearch
   tool). Look at the top ~10 organic results.
3. **Classify** each query:
   - **A** — the product's own origin appears in the top 3 organic results.
   - **B** — the product is reachable on page 1 only via sassmaker.com,
     GitHub, or a directory/aggregator (own domain absent from top 3).
   - **C** — the product is absent from the first page entirely.
   Record the top 2-3 result URLs as evidence and a one-line note (who owns
   the SERP, collisions, anything surprising).
4. **Record**: write all entries to a temp JSON file
   (`[{date, product, qid, class, top: [urls], notes}]`, date = today
   YYYY-MM-DD), then:
   `node fleet-ops/scripts/geo-observatory-record.mjs <file>`
   The script validates (unknown product/qid/class → rejected, nothing
   written) and regenerates `fleet-ops/docs/geo-observatory-latest.md`.
5. **Commit + push** the ledger + report from the fleet root:
   `git add fleet-ops/data/geo-observatory fleet-ops/docs/geo-observatory-latest.md`
   with message `geo-observatory: <date> run (<n> observations)`.
6. **Report to the user** (or the scheduled-run summary): the Movers section
   verbatim, plus anything that needs a decision (e.g. a collision worsened,
   a C that should be A given work already shipped — flag likely cause:
   not deployed? not indexed? blocked?).

## Rules

- Evidence over vibes: never classify without listing the top URLs seen.
- One observation per product/query per day (re-runs same day overwrite in
  the report, ledger keeps both — avoid re-running without reason).
- SERPs are noisy: a single-step change is signal only if it persists two
  runs; say so in the summary rather than announcing victory.
- Citation probes (Perplexity/ChatGPT APIs) are phase-2: only run if the
  relevant API key is available in the environment; never scrape engine UIs.
- Cost: one run should be one focused session — probe, classify, record,
  commit, summarize. Don't expand scope mid-run.
