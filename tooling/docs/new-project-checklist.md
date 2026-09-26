# New project checklist

The canonical gate list for every new Fleet product or project. Work top to
bottom; a phase can be skipped only with a recorded reason (e.g. no public
surface, private tool). Each item points at its canonical doc or skill — this
file is the index, not the explanation.

**Automation contract:** when the owner is done playing with a project, the
`fleet-launch` skill drives this list — `tooling/scripts/project-readiness.mjs`
detects what's observably done (`--project <id>`, `--live` adds live probes),
the agent fixes gaps with the named tools, and owner-only decisions (visual
system, domain purchase, deploy approval, launch manifest, human-kick
submissions) surface as an explicit gate list instead of silent skips.

Recorded: 2026-09-25.

## 0. Decide

- [ ] Name and domain — `name-domains` skill for candidates; register or pick
      the canonical URL before building surfaces around it
- [ ] One-line pitch, audience, and category (support, personal+free-tool,
      personal+saas, data, research, support+saas)
- [ ] Stack choice per the Fleet stack-quality rule in root `AGENTS.md` —
      strongest evidenced fit, not fastest to implement
- [ ] Repo placement — new repo vs. existing repo vs. shared tooling
      (`fleet-workspace` skill decides cross-project boundaries)

## 1. Scaffold

Via the `fleet-init` skill / `tooling/scripts/fleet-init.sh`:

- [ ] GitHub repo created and cloned into `~/Desktop/fleet/<name>/`
- [ ] `AGENTS.md`, `PROJECT_STATUS.md` (all 6 required sections), `.gitignore`
- [ ] CI workflow (lint + typecheck + test), green on the scaffold
- [ ] Fleet README entry in the right category
- [ ] Wrangler config if Cloudflare; schema + first migration if a DB
- [ ] README that gets a stranger running (`readme` skill) and a
      `local-verification` pass — clone to serving locally in <5 min
- [ ] `openspec/` spec home — `openspec init --tools claude,codex,devin`
      (fleet-init does this when the CLI is installed); `openspec-*` skills
      hold spec truth in-repo, `spec-driven` keeps the GitHub tracking issue

## 2. Register in the portfolio

The `project-register` skill runs this phase end to end.

- [ ] `catalog/projects.json` entry in SaaS Maker — classification, purpose,
      lifecycle, repositories, deployment
- [ ] `pnpm catalog:sync` in saas-maker, then `pnpm --dir ../site-health
      docs:projects` so the project dossier generates
- [ ] `presentation.directory` metadata filled (a few material `technologies`,
      not a dependency dump) + `pnpm catalog:sync-public` when the product is
      publicly listed
- [ ] Canonical entity-identity record so the name-agreement check has
      something to compare against
      (`tooling/docs/agent-indexing-standard.md` → Name agreement)

## 3. Landing + design

- [ ] Landing engine chosen — `templates/web-landing`, the `ios-landings`
      factory, or the app homepage itself. Bespoke needs a written reason;
      see `docs/landing-surface-classification.md`
- [ ] `design-workflow` run — owner picks the visual system; browser evidence
      and quality gates pass before it's called designed
- [ ] Footer contract — authored product footer, then project strip + Ask AI
      shared extension (Site Health `docs/footer-compliance-latest.md`)
- [ ] Favicon set (`favicon` skill) and OG/social image (`feature-image` skill)
- [ ] Verified at 390 / 768 / 1440 px; no invented screenshots, customers,
      numbers, or integrations anywhere on the page

## 4. Trust + security basics

- [ ] Privacy policy (and terms if applicable), linked from the footer — only
      claims the code actually keeps (`security-audit` verifies this)
- [ ] Security headers; Turnstile on public forms/waitlists (`turnstile-spin`)
- [ ] `security-audit` baseline pass — no secrets in repo, cookie flags, CORS,
      rate limiting where relevant

## 5. Deploy + links

- [ ] Deployed (Cloudflare by default); every Cloudflare resource attributed
      to this project in the catalog/dossier — nothing unowned
- [ ] `cloudflare-spend-guard` — new resources stay inside free-tier or
      explicitly approved spend
- [ ] DNS + canonical URL settled; www/apex redirect and HTTPS correct
- [ ] GitHub repo metadata — homepage URL, description, topics
      (`tooling/scripts/github-repo-audit.mjs`; apply only catalog-approved
      values)
- [ ] `fleet-deploy-guard` clean before first real deploy

## 6. SEO + GEO + indexing

- [ ] `seo-audit` pass — title, meta, canonical, OG, JSON-LD, sitemap,
      headings, alt text
- [ ] Agent-indexing S-tier — `llms.txt`, `/api/ai`, markdown alternates on
      public routes, robots + `Sitemap:`, name agreement, HEAD/GET parity.
      `agent-surfaces` implements, `agent-ready` audits
- [ ] JSON-LD `@graph` block — Organization + WebSite/app nodes with the
      canonical name (`agent-surfaces` skill; rules in the indexing standard)
- [ ] URLs submitted — `pnpm --dir site-health indexing submit` (IndexNow +
      Search Console sitemap); Search Console property registered so Site
      Health collects it
- [ ] Brand-check floor — `tooling/scripts/seo-brand-check.mjs` passes (Google
      binds the product name to the domain)

## 7. Analytics + observability

- [ ] Microsoft Clarity project + snippet wired
      (`clarity-fleet-rollout` skill; `templates/clarity-snippet.html`)
- [ ] App Health pings for the events worth alerting on — signup,
      waitlist.join, payment.failed (`ping` skill); skip only if nothing to
      alert on
- [ ] Site Health picks the domain up for performance + Search Console
      collection (follows from the catalog entry — verify, don't assume)

## 8. Launch

- [ ] `ship-check` gauntlet on the launch PR — scaffolding swept, loose ends
      wired, actually ran it, blast-radius regressions checked, adversarial
      review done
- [ ] Optional pre-launch sweeps: `bug-finder` (one GitHub issue per real
      bug), `test-quality` (core-loop regression test), `clarity-audit` +
      `error-message-audit` (first-time-user copy)
- [ ] Positioning/copy pass (`marketing` skill) — claims match what shipped
- [ ] Launchkit run — fill `tooling/launchkit/brief.template.md`,
      `plan-run.mjs`, tracker, `report.mjs`; honest-evidence rules apply
      (`submitted` ≠ `scheduled` ≠ `live`)
- [ ] One-off push via `launch-campaign` (owner-approved manifest) if this is
      a real launch, not a quiet ship
- [ ] Enrolled in `growth-loop` for recurring submission batches afterwards

## 9. Post-launch verification

- [ ] `public-product-smoke` — a guest can complete the core loop
- [ ] Performance baseline — `web-perf` / `psi-swarm` run recorded
- [ ] `fleet-deploy-parity` — production matches `origin/main`
- [ ] `search-indexing` status tracked until indexed or day 14
- [ ] `PROJECT_STATUS.md` updated to reflect what is actually live
- [ ] `learnings` — durable setup knowledge codified into the repo's
      AGENTS.md/README for the next agent
- [ ] GEO tracking — query added to `geo-observatory` scope if the product
      should be measured weekly
- [ ] `seo-sprint` kickoff if the product should grow organic traffic
      (`content-coverage` audits the intent/page gaps first)

## Conditional branches

- **iOS / native app** — the public page comes from the `ios-landings`
  factory, not `web-landing`. `apple-release` covers release readiness,
  `screenmap` covers Expo/RN screen coverage, `ios-app-growth` covers
  distribution experiments.
- **LLM-powered product** — follow `docs/ai-client-standard.md` pins
  (`ai@6.0.168`, product-owned `AI_BASE_URL`/`AI_API_KEY`, no shared gateway)
  and run `llm-cost-audit` before launch: spend cap, bounded retries, output
  caps. AI bills blow up by default, not by accident.
- **No public web surface** — skip phases 3, 6, and the Clarity line of 7,
  but record the exception in the catalog entry so audits don't flag it as
  missing.
