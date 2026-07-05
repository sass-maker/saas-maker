---
name: agent-ready
description: Check if a website is ready for AI agents — can GPTBot, ClaudeBot, Perplexity, and other AI crawlers discover and read the site? Scans robots.txt AI rules, sitemap, markdown negotiation, content signals, and more via isitagentready.com. Use when the user asks "is my site ready for AI?", "can AI crawlers read my site?", "check AI crawler access", "is GPTBot blocked?", "agent readiness scan", or wants to verify a site is discoverable by AI agents before launch.
metadata:
  short-description: Check if a site is AI-agent ready
---

# Agent Ready

Check whether a website is ready for AI agents and crawlers (GPTBot,
ClaudeBot, PerplexityBot, Google-Extended, etc.) to discover and read
its content. Uses the [isitagentready.com](https://isitagentready.com)
scan API.

## When to use

- "Is my site ready for AI agents?"
- "Can GPTBot / ClaudeBot read my site?"
- "Is my site being crawled by AI?"
- "Check AI crawler access for X"
- "Am I blocking AI bots?"
- Before launching a new product — verify AI agents can discover it

## How to invoke

```bash
curl -s 'https://isitagentready.com/api/scan' \
  -H 'content-type: application/json' \
  -H 'origin: https://isitagentready.com' \
  -H 'referer: https://isitagentready.com/' \
  --data-raw '{"url":"<URL>","enabledChecks":["robotsTxt","sitemap","linkHeaders","dnsAid","markdownNegotiation","robotsTxtAiRules","contentSignals","webBotAuth","apiCatalog","oauthDiscovery","oauthProtectedResource","authMd","mcpServerCard","agentSkills","webMcp","x402","mpp","ucp","acp"]}'
```

Replace `<URL>` with the target (e.g. `https://codevetter.com`).

## What the checks mean

| Check | What it tests |
|---|---|
| **robotsTxt** | robots.txt exists and is parseable |
| **robotsTxtAiRules** | robots.txt has AI-specific rules (GPTBot, ClaudeBot, etc.) — are they allowed or blocked? |
| **sitemap** | sitemap.xml exists so crawlers can discover all pages |
| **linkHeaders** | Link headers for discovery (RFC 9264) |
| **contentSignals** | HTML meta tags / structured data that help agents understand the site |
| **markdownNegotiation** | Server responds to `Accept: text/markdown` — can agents get clean text instead of HTML? |
| **dnsAid** | DNS AID records for agent identification |
| **webBotAuth** | Web Bot Auth protocol — can agents prove who they are? |
| **apiCatalog** | API discovery via well-known URIs |
| **oauthDiscovery** | OAuth 2.0 server metadata discovery |
| **oauthProtectedResource** | OAuth Protected Resource metadata |
| **authMd** | auth.md file with agent auth instructions |
| **mcpServerCard** | MCP server card (.well-known/mcp.json) |
| **agentSkills** | Agent skills discovery (AGENTS.md, .well-known/agents.json) |
| **webMcp** | Web MCP transport support |
| **x402** | x402 payment protocol support |
| **mpp** | Model Provider Protocol |
| **ucp** | Universal Content Protocol |
| **acp** | Agent Communication Protocol |

## Output

The API returns JSON with per-check results. Parse it and report:

1. **Pass/fail per check** — which checks passed, which failed
2. **Summary** — N/19 checks passed
3. **AI crawler access** — specifically: are GPTBot, ClaudeBot, PerplexityBot, Google-Extended allowed or blocked in robots.txt?
4. **Actionable gaps** — what's missing and how to fix it (e.g. "add GPTBot to robots.txt Allow list", "add a sitemap", "serve markdown via content negotiation")

## Fleet usage

To scan a fleet product, read the production URL from the project's
`PROJECT_STATUS.md` (Products section) or from
`saas-maker/scripts/lib/fleet-health-contracts.mjs`.

To scan all fleet products:

```bash
for url in $(grep -oE 'https://[^ "]+' ~/Desktop/fleet/README.md | sort -u); do
  echo "=== $url ==="
  curl -s 'https://isitagentready.com/api/scan' \
    -H 'content-type: application/json' \
    -H 'origin: https://isitagentready.com' \
    -H 'referer: https://isitagentready.com/' \
    --data-raw "{\"url\":\"$url\",\"enabledChecks\":[\"robotsTxt\",\"sitemap\",\"linkHeaders\",\"dnsAid\",\"markdownNegotiation\",\"robotsTxtAiRules\",\"contentSignals\",\"webBotAuth\",\"apiCatalog\",\"oauthDiscovery\",\"oauthProtectedResource\",\"authMd\",\"mcpServerCard\",\"agentSkills\",\"webMcp\",\"x402\",\"mpp\",\"ucp\",\"acp\"]}"
  echo
done
```

## Interpretation

Not every check needs to pass. Priorities by product type:

- **Marketing/landing sites**: robotsTxt, robotsTxtAiRules, sitemap, contentSignals, markdownNegotiation
- **API products**: apiCatalog, oauthDiscovery, oauthProtectedResource, webBotAuth
- **Agent-facing products**: mcpServerCard, agentSkills, webMcp, authMd
- **Monetized APIs**: x402

Don't chase 19/19 unless the product is explicitly an agent platform. Focus on
the checks relevant to the product's surface. The most common gap is
robotsTxtAiRules — many sites block AI crawlers by default or don't list them
at all.
