---
name: agent-ready
description: Scan any URL for agent readiness — robots.txt, sitemap, AI rules, markdown negotiation, web bot auth, MCP server card, agent skills, OAuth discovery, and more. Use when the user asks "is my site agent-ready?", "can agents read my site?", "check agent readiness", "scan for AI crawlers", or wants to verify a site is discoverable/negotiable by AI agents.
metadata:
  short-description: Scan URLs for AI agent readiness
---

# Agent Ready

Scan any URL with [isitagentready.com](https://isitagentready.com) to check
whether a site is discoverable and negotiable by AI agents.

## When to use

- "Is my site agent-ready?"
- "Can agents read my site?"
- "Check agent readiness for X"
- "Scan for AI crawlers / bot auth / MCP discovery"
- Before launching a new product — verify agents can find and interact with it

## How to invoke

```bash
curl -s 'https://isitagentready.com/api/scan' \
  -H 'content-type: application/json' \
  -H 'origin: https://isitagentready.com' \
  -H 'referer: https://isitagentready.com/' \
  --data-raw '{"url":"<URL>","enabledChecks":["robotsTxt","sitemap","linkHeaders","dnsAid","markdownNegotiation","robotsTxtAiRules","contentSignals","webBotAuth","apiCatalog","oauthDiscovery","oauthProtectedResource","authMd","mcpServerCard","agentSkills","webMcp","x402","mpp","ucp","acp"]}'
```

Replace `<URL>` with the target (e.g. `https://codevetter.com`).

## Checks

| Check | What it tests |
|---|---|
| robotsTxt | robots.txt exists and is parseable |
| sitemap | sitemap.xml exists and lists URLs |
| linkHeaders | Link headers for discovery (RFC 9264) |
| dnsAid | DNS AID records for agent identification |
| markdownNegotiation | Server responds to `Accept: text/markdown` |
| robotsTxtAiRules | robots.txt has AI-specific rules (User-agent: GPTBot, etc.) |
| contentSignals | HTML meta tags / structured data for agent hints |
| webBotAuth | Web Bot Auth protocol support |
| apiCatalog | API discovery (well-known URIs) |
| oauthDiscovery | OAuth 2.0 server metadata discovery |
| oauthProtectedResource | OAuth Protected Resource metadata |
| authMd | auth.md file for agent auth instructions |
| mcpServerCard | MCP server card (.well-known/mcp.json) |
| agentSkills | Agent skills discovery (AGENTS.md, .well-known/agents.json) |
| webMcp | Web MCP transport support |
| x402 | x402 payment protocol support |
| mpp | Model Provider Protocol |
| ucp | Universal Content Protocol |
| acp | Agent Communication Protocol |

## Output

The API returns JSON with per-check results. Parse it and report:

1. **Pass/fail per check** — which checks passed, which failed
2. **Summary** — N/19 checks passed
3. **Actionable gaps** — what's missing and how to fix it

## Fleet usage

When scanning a fleet product, read the production URL from the project's
`PROJECT_STATUS.md` (Products section) or from `saas-maker/scripts/lib/fleet-health-contracts.mjs`.

To scan all fleet products at once:

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

Not every check needs to pass for every site. Priorities by product type:

- **Marketing/landing sites**: robotsTxt, sitemap, contentSignals, markdownNegotiation
- **API products**: apiCatalog, oauthDiscovery, oauthProtectedResource, webBotAuth
- **Agent-facing products**: mcpServerCard, agentSkills, webMcp, authMd
- **Monetized APIs**: x402

Don't chase 19/19 unless the product is explicitly an agent platform. Focus on
the checks relevant to the product's surface.
