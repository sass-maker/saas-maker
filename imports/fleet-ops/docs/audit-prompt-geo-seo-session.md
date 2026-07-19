# Audit prompt — GEO / SEO / IndexNow / deploy session

Copy-paste to a **fresh agent** (Codex / Claude / Grok / Cursor).  
Use **read-only** capability first; only write if you agree fixes.

---

## Prompt

```
You are an independent auditor of a multi-repo fleet at ~/Desktop/fleet
(sass-maker/fleet-workspace root + per-product child git repos).

## Mission
Audit ALL work from the recent GEO / SEO / directory-submission / Cloudflare
deploy session. Be skeptical. Prefer live evidence over git claims. Report
what actually works, what is incomplete, residual risk, and ranked next actions.

You may use ANY tools/bots available (web search, browser, shell, wrangler,
curl, node audits, gh). Do NOT print secrets, env values, API keys, or Infisical
payloads. Do NOT deploy unless the human explicitly asks after your report.

## Context (what the previous agent claims)
1. Parallel directory spray (Playwright) for ~23 products × many directories;
   logs at fleet-ops/config/directory-submissions/{log.jsonl,status.json,products.json}.
2. Agent surfaces applied fleet-wide: llms.txt, llms-full.txt, index.md,
   api-ai.json, robots, agent-edge where workers exist
   (apply-agent-surfaces.mjs + agent-surfaces-registry.json).
3. Production Wrangler deploys; claim ~23/23 live for /llms.txt + /api/ai + /index.md.
4. Codevetter custom domain served by Worker codevetter-landing-proxy
   (wrangler.worker.jsonc), not only Pages.
5. SWE /api/ai patched in functions/api/[[path]].js.
6. sassmaker.com expanded as fleet citation hub.
7. IndexNow tooling added: fleet-ops/scripts/indexnow-submit.mjs +
   fleet-ops/config/indexnow.json + fleet-ops/docs/indexnow.md
   (Bing/Yandex/etc.; NOT Google).
8. Strategy docs: fleet-ops/docs/geo-dr-outcomes.md, directory-submissions.md.

## Hard rules (fleet)
- Read AGENTS.md / fleet-ops/docs/fleet-agent-standards.md if needed.
- No secrets in output; no destructive git; no production deploy unless asked.
- Smallest relevant checks first; cite file paths and live URLs.

## Audit checklist (do all)

### A. Live GEO matrix (mandatory)
For every product in fleet-ops/config/agent-surfaces-registry.json:
  GET {url}/llms.txt  → 200, NOT HTML, body starts with #
  GET {url}/api/ai    → 200 JSON with name + surfaces (or equivalent catalog)
  GET {url}/index.md  → 200, NOT HTML, markdown
  GET {url}/robots.txt and note Sitemap: lines
  GET sitemap URL(s) → real XML, not SPA HTML shell
Special cases:
  - pace: check https://heypace.app (primary), not only pages.dev
  - codevetter.com vs codevetter.pages.dev if custom domain differs
  - reader / swe-interview-prep sitemap SPA issues historically
Produce a table: product | host | llms | api/ai | index.md | sitemap | grade

Also run if present:
  node fleet-ops/skills/agent-ready/scripts/agent-index-audit.mjs --all
Compare your matrix to that output.

### B. SEO sample (on-page)
Run seo-audit on at least: rolepatch.com, codevetter.com, sassmaker.com,
highsignal.app, heypace.app, posttrainllm.com:
  bash fleet-ops/skills/seo-audit/scripts/seo-audit.sh <url> --site <origin>
Summarize FAIL/WARN only.

### C. IndexNow tooling correctness
Review fleet-ops/scripts/indexnow-submit.mjs + config/indexnow.json + docs/indexnow.md:
  - Does --init-key / --apply-keys / --check-keys / --dry-run / --id work?
  - Key is public-by-design; is it treated that way?
  - Batch size, host scoping, sitemap HTML detection, agent URL always-include
  - Confirm Google is correctly documented as NOT supported
  - Are key files present under product publicDirs after --apply-keys?
  - Are any keys live on production (/{key}.txt)? If not, say “submit will fail until deploy”
Run: node fleet-ops/scripts/indexnow-submit.mjs --check-keys
Run: node fleet-ops/scripts/indexnow-submit.mjs --dry-run --max 20
Do NOT call real IndexNow submit unless key files are live AND human asks.

### D. Deploy / git residual risk
Per product: branch, unpushed commits, dirty agent files.
Known issues to verify:
  - codevetter pre-push husky false-positive on secret_policy.rs
  - posttrainllm/pace agent work may have been on feature branches
  - apply-agent-surfaces multi-line import bug (karte worker) — fixed?
Spot-check worker.mjs files for broken:
  import {
  import { handleAgentEdge }

### E. Directory spray honesty
From directory-submissions status/log:
  - Confirmed likely counts vs submitted_unknown spam volume
  - What is NOT automatable (CAPTCHA/OAuth)
  - Explicitly judge whether spray can raise Ahrefs DR (expected: no)

### F. Web discoverability (optional but valuable)
Web-search a sample of product names/domains. Classify:
  A findable as brand | B only via fleet hub | C invisible
Compare to earlier claim that only RolePatch/CodeVetter/Foundry/AliveVille are strong.

### G. Analytics gap
Confirm PostHog is instrumented in some apps but GSC/IndexNow are separate.
State whether sitemaps are sufficient for GSC onboarding now.

## Output format (strict)

# Fleet GEO/SEO Audit Report
## Executive verdict
(2–4 sentences: what is actually true in production)

## Live matrix
(table)

## Passes
(bullet list with evidence)

## Failures / gaps
(severity P0/P1/P2 + evidence + suggested fix)

## IndexNow readiness
(ready / blocked + why)

## Directory spray value
(honest assessment)

## Residual risks
(secrets, unpushed commits, SPA sitemaps, name collisions)

## Recommended next 7 actions
(ordered, concrete commands where possible)

## What the previous agent overstated
(if anything)

## What the previous agent understated / did well
(if anything)

Do not invent DR scores or index counts without fetching them.
If a check is skipped, say why.
```

---

## Shorter variant (time-boxed)

```
Audit ~/Desktop/fleet GEO/SEO work. Read-only.

1) Live-check all products in fleet-ops/config/agent-surfaces-registry.json
   for /llms.txt, /api/ai, /index.md, sitemap (real XML not HTML).
2) Run agent-index-audit.mjs --all if available.
3) Review IndexNow script (fleet-ops/scripts/indexnow-submit.mjs): --check-keys,
   --dry-run --max 20; do not submit unless keys live.
4) Spot seo-audit on rolepatch, codevetter, sassmaker, heypace, posttrainllm.
5) Report P0/P1 gaps, unpushed commits, SPA sitemaps, overclaims.
No deploys, no secrets, no force-push.
```
