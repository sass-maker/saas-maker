# New project checklist

The gate list for a new Fleet product or project. New projects start only
when the owner explicitly asks for one. Work top to bottom; skip a phase only
with a recorded reason (for example no public surface, or a private tool).
Each item points at its canonical doc or skill: this file is the index, not
the explanation.

Owner-only decisions (visual system, domain purchase, deploy approval, launch
plan approval, paid submissions) surface as an explicit list for the owner,
never as silent skips or agent guesses.

Recorded 2026-09-25 on an unmerged sweep branch; restored and corrected
2026-10-08 to reference only skills and files that exist.

## 0. Decide

- [ ] Owner asked for this project explicitly (not inferred from a task)
- [ ] Name and domain: `name-domains` skill for candidates; pick the canonical
      URL before building surfaces around it
- [ ] One-line pitch, audience, and category (support, personal+free-tool,
      personal+saas, data, research, support+saas)
- [ ] Stack choice per the Fleet stack-quality rule in the root `AGENTS.md`:
      strongest evidenced fit, not fastest to implement
- [ ] Repo placement: new repo vs. existing repo vs. shared tooling

## 1. Scaffold

Via the `fleet-init` skill (`tooling/scripts/fleet-init.sh`):

- [ ] GitHub repo created and cloned into `~/Desktop/fleet/<name>/`
- [ ] `AGENTS.md`, `PROJECT_STATUS.md` (all 6 required sections), `.gitignore`
- [ ] CI workflow (lint + typecheck + test), green on the scaffold
- [ ] Wrangler config if Cloudflare; schema + first migration if a DB
- [ ] README that gets a stranger running, plus a local clone-to-serving check
      (`tooling/scripts/verify-local.mjs`)

The Fleet root is not a Git repository and has no README index; the catalog
in phase 2 is the project list.

## 2. Register in the portfolio

- [ ] `catalog/projects.json` entry in SaaS Maker: classification, purpose,
      lifecycle, repositories, deployment
- [ ] `pnpm catalog:sync` in saas-maker, then `pnpm --dir ../site-health
      docs:projects` so the project dossier generates
- [ ] `presentation.directory` metadata filled (a few material `technologies`,
      not a dependency dump) when the product is publicly listed
- [ ] Canonical entity identity so the name-agreement check has something to
      compare against (`tooling/docs/agent-indexing-standard.md`)

## 3. Landing + design

- [ ] Landing engine chosen: `tooling/templates/web-landing`, the
      `ios-landings` factory, or the app homepage itself. Bespoke needs a
      written reason; see `tooling/docs/landing-surface-classification.md`
- [ ] `design-workflow` run: the owner picks the visual system; browser
      evidence and quality gates pass before it is called designed
- [ ] Footer contract: authored product footer, then project strip + Ask AI
      shared extension (Site Health `docs/footer-compliance-latest.md`)
- [ ] Favicon set and OG/social image
- [ ] Verified at 390 / 768 / 1440 px; no invented screenshots, customers,
      numbers, or integrations anywhere on the page

## 4. Trust + security basics

- [ ] Privacy policy (and terms if applicable), linked from the footer, that
      only claims what the code actually does
- [ ] Security headers; Turnstile on public forms/waitlists (`turnstile-spin`)
- [ ] No secrets in the repo; cookie flags, CORS, and rate limiting where
      relevant

## 5. Deploy + links (owner approves the deploy)

- [ ] Deployed (Cloudflare by default); every Cloudflare resource attributed
      to this project in the catalog/dossier, nothing unowned
- [ ] `cloudflare-spend-guard`: new resources stay inside free tier or
      explicitly approved spend
- [ ] DNS + canonical URL settled; www/apex redirect and HTTPS correct
- [ ] GitHub repo metadata: homepage URL, description, topics (catalog-approved
      values only)
- [ ] `fleet-deploy-parity` deploy guard clean before the first real deploy

## 6. SEO + GEO + indexing

- [ ] `seo-audit` pass: title, meta, canonical, OG, JSON-LD, sitemap, headings,
      alt text
- [ ] Agent indexing: `llms.txt`, `/api/ai`, markdown alternates, robots +
      `Sitemap:`, name agreement, HEAD/GET parity. Templates in
      `tooling/templates/agent-surfaces`; `agent-ready` audits
- [ ] JSON-LD `@graph` block with Organization + WebSite/app nodes using the
      canonical name (rules in the indexing standard)
- [ ] Search Console property registered so Site Health collects it; sitemap
      submitted

## 7. Analytics + observability

- [ ] Microsoft Clarity project + snippet wired (`clarity-fleet-health`
      rollout reference; `tooling/templates/clarity-snippet.html`)
- [ ] App Health pings for events worth alerting on, such as signup,
      waitlist.join, payment.failed (`ping` skill); skip only if nothing to
      alert on
- [ ] Site Health picks the domain up for performance + Search Console
      collection (follows from the catalog entry; verify, don't assume)

## 8. Launch (owner approves the plan)

- [ ] `test-quality`: a regression test on the core loop
- [ ] Positioning/copy pass (`marketing` skill): claims match what shipped
- [ ] `launch-campaign`: one owner-approved plan; directory runs use its
      launchkit reference (`tooling/launchkit/`). Honest-evidence rules apply
      (`submitted` is not `scheduled` is not `live`)

## 9. Post-launch verification

- [ ] `public-product-smoke`: a guest can complete the core loop
- [ ] Performance baseline recorded (`web-perf`)
- [ ] `fleet-deploy-parity`: production matches `origin/main`
- [ ] `PROJECT_STATUS.md` updated to reflect what is actually live
- [ ] GEO tracking: query added to `geo-observatory` scope if the product
      should be measured weekly
- [ ] `content-coverage` audit if the product should grow organic traffic

## Conditional branches

- **iOS / native app**: the public page comes from the `ios-landings`
  factory, not `web-landing`. `apple-native` covers build and QA,
  `apple-release` covers release.
- **LLM-powered product**: follow `tooling/docs/ai-client-standard.md`; set a
  spend cap, bounded retries, and output caps before launch.
- **No public web surface**: skip phases 3, 6, and the Clarity line of 7, and
  record the exception in the catalog entry so audits don't flag it.
