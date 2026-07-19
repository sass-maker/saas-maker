---
name: site-health
description: >
  Front door for all website measurement across the fleet. Use when the user
  asks: is my site healthy / audit my site / full health check; can AI
  crawlers read it (GPTBot, ClaudeBot, llms.txt, GEO, agent readiness); is
  the SEO right (meta tags, canonical, OG, structured data, sitemap); is it
  fast (Core Web Vitals, LCP/CLS/INP, Lighthouse, PageSpeed); or did our
  search/AI visibility results move (SERP trend, weekly observatory). Routes
  to the right subskill, or runs the combined per-product scorecard.
---

# site-health — fleet website measurement (routing parent)

Route by intent. Each subskill's SKILL.md is the full protocol — read the
one you need, not all four.

| Intent | Read and follow |
|---|---|
| AI/agent readiness: llms.txt, /api/ai, index.md, robots vs AI crawlers, GEO surfaces | `fleet-ops/skills/agent-ready/SKILL.md` |
| On-page SEO: title/meta/canonical/OG/JSON-LD/hreflang/sitemap coverage | `fleet-ops/skills/seo-audit/SKILL.md` |
| Performance: Core Web Vitals, Lighthouse distributions, "why is X slow" | `fleet-ops/skills/psi-swarm/SKILL.md` |
| Outcome trends: SERP classes over time, "did results move", weekly run | `fleet-ops/skills/geo-observatory/SKILL.md` |

## Combined mode — "full health check"

For "audit everything", "full health check", "fleet health scorecard", one
product or `--all`:

```bash
node fleet-ops/scripts/site-health-scorecard.mjs --all       # whole registry
node fleet-ops/scripts/site-health-scorecard.mjs --id pace   # one product
```

This live-probes GEO surfaces (agent-index-audit), reads the latest
geo-observatory trend classes from the ledger, and folds in the most recent
seo/perf artifacts when present (it does not re-run those heavier audits —
invoke their subskills for fresh data). Output:
`fleet-ops/docs/site-health-latest.md` — one row per product with a
worst-problem note. Report the Problems section to the user, not the raw
table dump.

## Conventions (all subskills)

- Targets resolve via `fleet-ops/scripts/lib/registry.mjs`
  (agent-surfaces-registry.json is the canonical product list).
- Reports land at `fleet-ops/docs/<skill>-latest.md`.
- Evidence over vibes: cite URLs/numbers for every failing grade.
