---
name: fleet-launch
description: Graduate a finished-playing Fleet project into a launched product — detect checklist gaps, perform every automatable item, and queue the owner gates. Use for "launch X", "X is ready to go public", "graduate X", "done playing with X — ship it", or "run the new-project checklist on X".
---

# fleet-launch — project graduation driver

The executable half of `tooling/docs/new-project-checklist.md`. Given a
project the owner is done playing with, drive it from wherever it is to
launched: detect what's missing, do what's automatable, and hand the owner a
short, explicit gate list for what needs their decision.

## Ground rule

This skill orchestrates existing tools; it does not re-implement them. Every
fix below names the script, skill, or doc that owns it. If a fix would need a
deploy, DNS change, purchase, or credential, it is an **owner gate** — never
do it silently; list it and wait.

## Loop

```bash
node tooling/scripts/project-readiness.mjs --project <id>          # gap report
# ... work the gaps ...
node tooling/scripts/project-readiness.mjs --project <id> --live   # verify after deploy
```

Resolve `<id>` from the Fleet directory name or the SaaS Maker catalog id.
If the project has no catalog entry yet, `--repo <dirname>` still reports
local gaps — registration itself is a gap it will flag.

## Fixing gaps, in checklist order

| Gap | Fix |
|---|---|
| scaffold.* | `fleet-init` covers the contract; add the missing file by hand for an existing repo. `scaffold.openspec` → `openspec init --tools claude,codex,devin` |
| catalog.* / identity.record / dossier.exists | `project-register` skill — drafts the catalog record, syncs views, regenerates the dossier, records identity. Classification diffs are shown to the owner |
| landing.surface | Pick the engine first: `templates/web-landing`, `ios-landings` factory, or app-homepage-as-landing (`docs/landing-surface-classification.md`). Bespoke needs a written reason. Design quality is the `design-workflow` owner gate below |
| footer.contract | Product-owned footer + `project-strip.js` + `ai-chat-footer.js` (`templates/web-landing` already ships both; Site Health `docs/footer-compliance-latest.md`) |
| assets.favicon | `favicon` skill — needs a source image; derive from logo/wordmark if none exists |
| assets.ogImage | `feature-image` skill — auto-detects fonts/colors/logo from the codebase |
| legal.privacy | Draft `/privacy` matching what the code actually does; link from footer |
| security.forms | `turnstile-spin` skill (needs Cloudflare dashboard — pause for the site key if not provided) |
| agent.* | `agent-surfaces` skill — llms.txt, `/api/ai`, markdown alternates, robots/sitemap, JSON-LD per stack mode A–D |
| clarity.registry | `clarity-fleet-rollout` skill — creating the Clarity project needs the signed-in browser; wiring the ID is code |
| github.metadata | `node tooling/scripts/github-repo-audit.mjs --project <id> --apply homepage,description,topics` |
| live.* | Deploy gate below — these only pass post-deploy |

## Owner gates — stop and list, never auto-do

1. **Visual system** — `design-workflow` requires the owner to pick among the
   visual systems before an overhaul. Automation covers plumbing, not taste.
2. **Domain purchase** — `name-domains` proposes; the owner buys.
3. **Deploy / DNS** — every deploy and DNS change needs explicit approval
   (SaaS Maker and Site Health AGENTS rules). After the owner deploys, re-run
   with `--live` and submit URLs:
   `pnpm --dir site-health indexing submit --project <id> --sitemap`.
4. **Search Console property** — registration is a provider action; Site
   Health collects it once registered.
5. **Launch manifest** — `launch-campaign` shows the exact plan for approval
   before executing. Human-kick submissions (Product Hunt, HN, logins) stay
   with the owner.
6. **LLM products** — confirm `ai-client-standard` pins + `llm-cost-audit`
   before public launch.

## Finishing

After gaps close:

- Re-run `project-readiness.mjs --project <id> --live` until it reports zero
  fails (or every remaining fail is a recorded skip/exception).
- `seo-brand-check.mjs --project <id>` — the brand-query floor.
- Launch: fill `tooling/launchkit/brief.template.md` from the repo +
  catalog, run `plan-run.mjs`, hand the tracker to the executing agent.
- Post-launch: `public-product-smoke` guest journey, `web-perf`/`psi-swarm`
  baseline, `fleet-deploy-parity`, indexing status to day 14.
- Emit the receipt: what was auto-done, what the owner still owes, and the
  live URLs.
