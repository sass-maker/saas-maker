---
name: agent-ready
description: Subskill of site-health — AI/agent indexing audit (llms.txt, /api/ai, markdown negotiation, robots vs AI crawlers, SPA-fake detection). Route here from site-health for "can AI read my site" checks.
metadata:
  short-description: AI agent indexing audit (llms.txt, markdown, /api/ai)
---

# Agent Ready

Subskill of `site-health` — invoked directly or via the parent router.

Check whether a website is ready for AI agents and crawlers to **discover and
read product truth without JS**. Fleet S-tier is defined in
[`docs/agent-indexing-standard.md`](../../docs/agent-indexing-standard.md).

## Preferred: local fleet auditor

No external rate limits. Detects SPA-fake HTML shells on `/llms.txt`.

```bash
# one origin
node fleet-ops/skills/agent-ready/scripts/agent-index-audit.mjs https://rolepatch.com

# one health-contract project
node fleet-ops/skills/agent-ready/scripts/agent-index-audit.mjs --project rolepatch

# entire fleet
node fleet-ops/skills/agent-ready/scripts/agent-index-audit.mjs --all

# machine-readable
node fleet-ops/skills/agent-ready/scripts/agent-index-audit.mjs --all --json
```

### S-tier checks (local)

| Check | Pass |
|---|---|
| `llms_txt` | Real text starting with `#`, not HTML |
| `api_ai` | JSON catalog with `name`, `llms`, `surfaces[]` |
| `homepage_md` | `Accept: text/markdown` **or** `/index.md` |
| `not_spa_fake` | Agent paths are not SPA HTML shells |
| `robots` | Exists with User-agent |
| `sitemap` | `sitemap.xml` or `sitemap-index.xml` |

Implementation kit: `fleet-ops/lib/agent-surfaces/`.

## Optional: isitagentready.com

Use for protocol extras (MCP, OAuth, Web Bot Auth). Not the fleet S-tier gate.

```bash
curl -s 'https://isitagentready.com/api/scan' \
  -H 'content-type: application/json' \
  -H 'origin: https://isitagentready.com' \
  -H 'referer: https://isitagentready.com/' \
  --data-raw '{"url":"<URL>","enabledChecks":["robotsTxt","sitemap","linkHeaders","dnsAid","markdownNegotiation","robotsTxtAiRules","contentSignals","webBotAuth","apiCatalog","oauthDiscovery","oauthProtectedResource","authMd","mcpServerCard","agentSkills","webMcp","x402","mpp","ucp","acp"]}'
```

## What the external checks mean

| Check | What it tests |
|---|---|
| **robotsTxt** | robots.txt exists and is parseable |
| **robotsTxtAiRules** | AI-specific bot rules |
| **sitemap** | sitemap discovery |
| **markdownNegotiation** | `Accept: text/markdown` |
| **mcpServerCard** / **agentSkills** | Agent-native extras (S+, not required for all) |

## Fleet priorities by product type

- **Marketing / content**: `llms.txt`, page markdown, `/api/ai`, sitemap, robots
- **SPA + API**: honest catalog + API resource MD (mode D) — never empty shells
- **Agent-native (Karte-class)**: add `skill.md` + well-known skills (S+)

Do **not** chase 19/19 external checks unless the product is an agent platform.

## Relationship

| Skill | Covers |
|---|---|
| **agent-ready** | GEO / LLM indexing (this skill) |
| **seo-audit** | Classic on-page SEO |
| **psi-swarm** | Performance / Core Web Vitals |
