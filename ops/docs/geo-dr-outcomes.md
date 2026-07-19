# GEO + Domain Rating outcomes

**Goal of this program:** (1) AI systems cite and correctly describe fleet
products; (2) Domain Rating / authority rises on product domains.

Canonical skills: `agent-ready` (GEO), `seo-audit` (on-page SEO).  
Directory spray alone does **not** achieve either goal.

## What actually moves the needle

| Outcome | Lever | What we measure |
|---|---|---|
| AIs speak about products | Live S-tier agent surfaces + citable copy | `agent-index-audit --all` S-count; Perplexity/ChatGPT probes |
| Domain rating rises | Quality dofollow links + clean technical SEO | Ahrefs/DR via drank; indexed pages; referring domains |

Spam directories and undeployed `public/llms.txt` files do not count.

## Current baseline (2026-07-17, reconciled with audit + status.json)

**Live GEO:** independent audit found **24/24** hosts serving llms.txt / api/ai / index.md
with matching schemas; IndexNow keys **23/23** live. Agent-index-audit S-tier grades
were optimistic (tool ignores CF managed robots that block GPTBot/ClaudeBot on 13 hosts).

**On-page SEO:** RolePatch/DRank critical checks pass; highsignal + rolepatch had
site-wide canonical collapse (fixing in flight); SVG OG images still need PNG on
several products.

**Directories (`status.json` truth):** 842 unique pairs · 116 `submitted_likely` ·
623 `submitted_unknown` · 5 confirmed queues (Paggu 23, TheStartupInc 23+23,
Insidr 22, TechPluto 22). Not “3 confirmed” / not all 23/23. High-DA walls remain
human-kick. Spray ≠ DR.

## Workstream A — AI citations (GEO)

1. **Deploy agent surfaces** for every public origin (code mostly on `main`).
2. Keep **S-tier** green: `/llms.txt`, `/api/ai`, `/index.md` or MD negotiation, real (non-SPA) bodies, robots + sitemap.
3. **Citation hub:** `sassmaker.com` `llms.txt` / `index.md` / `/api/ai` list every product URL + one-line truth.
4. Re-audit: `node fleet-ops/skills/agent-ready/scripts/agent-index-audit.mjs --all`.
5. Spot-check: ask ChatGPT/Claude/Perplexity “what is RolePatch / CodeVetter / …” after deploy + crawl lag.

## Workstream B — Domain rating

1. **Human-kick high-DA only** (one product at a time, focus set first):  
   Product Hunt, Indie Hackers, AlternativeTo, SaaSHub, DevHunt, TAAFT, G2, Show HN.
2. **Stop treating free web-directory spray as DR work** — log it as awareness only.
3. **Fleet equity:** `sassmaker.com` and docs link out to product roots (dofollow).
4. **On-page hygiene** via `seo-audit` (title, OG, JSON-LD, sitemap, no SSR leaks).
5. **Track** with drank (`domains.sassmaker.com`) on custom domains weekly.

Focus marketing registry: `pace`, `codevetter`, `posttrainllm`  
(`fleet-ops/config/marketing-program.json`).

## Deploy gate (required)

Agent files on git ≠ live. Without production deploys, AI crawlers still see SPA shells / 404s.  
Deploy is **manual and explicit** — ask before any production deploy.

Priority deploy wave (max AI + focus impact):

1. codevetter.com  
2. posttrainllm.com  
3. heypace.app / pace pages  
4. highsignal.app, karte.cc, significanthobbies.com  
5. SPA shells with `agent-edge` already wired (reader, anime-list, free-ai, …)

## Explicit non-goals

- Solving CAPTCHA/OAuth with bots  
- Paying for directory packages without approval  
- Chasing 19/19 isitagentready.com protocol extras on every product  

## Commands

```bash
# GEO
node fleet-ops/skills/agent-ready/scripts/agent-index-audit.mjs --all

# On-page SEO
bash fleet-ops/skills/seo-audit/scripts/seo-audit.sh https://rolepatch.com/ --site https://rolepatch.com

# Apply agent files (then deploy)
node fleet-ops/scripts/apply-agent-surfaces.mjs

# JSON-LD structured data (see agent-indexing-standard.md § JSON-LD)
node fleet-ops/scripts/apply-agent-surfaces.mjs --jsonld --dry-run    # preview
node fleet-ops/scripts/apply-agent-surfaces.mjs --jsonld              # inject
node fleet-ops/scripts/apply-agent-surfaces.mjs --jsonld-emit         # emit snippets for JSX layouts

# IndexNow (Bing/Yandex/etc. — not Google). See docs/indexnow.md
node fleet-ops/scripts/indexnow-submit.mjs --init-key
node fleet-ops/scripts/indexnow-submit.mjs --apply-keys   # then deploy
node fleet-ops/scripts/indexnow-submit.mjs --check-keys
node fleet-ops/scripts/indexnow-submit.mjs --dry-run
node fleet-ops/scripts/indexnow-submit.mjs
```
