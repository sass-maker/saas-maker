# Fleet product checklist

Use this canonical checklist for initial readiness and ongoing product care.
New projects require an explicit owner request. Each item points at its owning
workflow; this is the index, not another tracker.

The operating cycle is **inspect → prioritize → improve → verify live →
measure outcomes → decide the next action**. A collector, source audit or report
covers only part of that cycle. A review may justify leaving a surface alone,
with a reason and next review date.

## The six scored categories

The phases feed the [product scoreboard's](../../docs/product-scoreboard.md) six categories:

| Category | Evidence of execution and outcomes |
| --- | --- |
| Product & feature parity | Complete promised workflows and useful results against relevant alternatives |
| Design & delight | Rendered usability, recovery and uncoached comprehension/preference observations |
| SEO & growth | Current intent-matched pages, qualified discovery and useful organic actions |
| GEO & AI visibility | Answer-ready evidence and observed inclusion, citations and accurate recommendations |
| Measurement & learning | Reliable collection plus a dated signal → decision → action → follow-up result |
| Engineering & operations | Correctness, performance, privacy, reliability and recovery in intended runtimes |

Each category has separate Effort and Result readings out of 10, with independent
totals out of 60 before justified exemptions. Effort is execution quality and
completeness; Result is demonstrated benefit. Keep evidence, dates, confidence
and unknowns explicit. Use the guide's rubric and one-lever cadence; hours and
tool presence do not earn points.

## Scope and completion

- [ ] Use the current catalog lifecycle, audience, and owner intent. Public
      growth applies where growth is intended; private tools need evidence of
      usefulness and reliability. Preserve inactive scope and privacy choices.
- [ ] For each applicable area, identify the intended outcome, baseline,
      acceptance condition, responsible owner, and review date in existing
      project issues or reports. Record justified Not applicable decisions.
- [ ] Keep implementation, live verification, and observed outcomes separate.
      Record the relevant release/URL, evidence date, measurement window and
      coverage. An old pass does not qualify a changed product indefinitely.
- [ ] Set realistic targets and review horizons; report improving, flat,
      declining or unknown outcomes with reasons and a next action.
      Instrumentation does not establish growth; flat results alone do not
      justify endless expansion.
- [ ] Finish safe work within the authorized scope, following the global
      release-autonomy policy. Small fixes and additive compatible changes have
      standing release authorization after checks and rollback preparation;
      other public releases need approval unless already approved. Do not install
      schedules or send outreach merely by checking a box.

## 0. Decide

- [ ] Owner asked for this project explicitly (not inferred from a task)
- [ ] Name and domain: `name-domains` skill for candidates; pick the canonical
      URL before building surfaces around it
- [ ] One-line pitch, audience, and category (support, personal+free-tool,
      personal+saas, data, research, support+saas)
- [ ] Core user problem, first useful result, relevant alternatives, and why
      the intended audience would choose this product are explicit
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

The Fleet root is unversioned; the catalog in phase 2 is the project list.

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
- [ ] Use [design-workflow](../skills/design-workflow/SKILL.md): preserve an
      existing surface's direction; new surfaces or explicit redesigns get
      distinct rendered directions for the owner to choose
- [ ] Landing, onboarding and application follow the same product design
      system and vocabulary; promises, screenshots, pricing and access match
      the actual product. Follow the real CTA to the first useful app state
- [ ] Footer contract: authored product footer, then project strip + Ask AI
      shared extension (Site Health `docs/footer-compliance-latest.md`)
- [ ] Favicon set and OG/social image
- [ ] Verified at 390 / 768 / 1440 px; no invented screenshots, customers,
      numbers, or integrations anywhere on the page
- [ ] Readability, keyboard/focus behavior, contrast, touch targets, and
      loading/empty/error/success states work in the rendered core journey;
      review changes after release. A design score or screenshot alone is
      insufficient evidence of usability

## 4. Trust + security basics

- [ ] Privacy policy (and terms if applicable), linked from the footer, that
      only claims what the code actually does
- [ ] Security headers; Turnstile on public forms/waitlists where applicable
- [ ] No secrets in the repo; cookie flags, CORS, and rate limiting where
      relevant
- [ ] Dependencies, privacy disclosures, data retention and recovery paths
      remain appropriate as the product changes; failures have an owner and a
      tested recovery path where data or service continuity requires one

## 5. Deploy + links

- [ ] Confirm release authorization under the global policy above; prepare
      rollback and verify the actual live change after release
- [ ] Deployed (Cloudflare by default); every Cloudflare resource attributed
      to this project in the catalog/dossier, nothing unowned
- [ ] `cloudflare-spend-guard`: new resources stay inside free tier or
      explicitly approved spend
- [ ] DNS + canonical URL settled; www/apex redirect and HTTPS correct
- [ ] GitHub repo metadata: homepage URL, description, topics (catalog-approved
      values only)
- [ ] `fleet-deploy-parity` deploy guard clean before the first real deploy

## 6. SEO + GEO + content growth

### SEO: maintain useful pages and earn relevant discovery

- [ ] [seo-research](../skills/seo-research/SKILL.md): identify audience,
      language/market, relevant queries and intent. Inspect current search
      results and competing pages for priority opportunities; keyword matching
      means satisfying the searcher's task, not repeating exact phrases
- [ ] Map priority intent/query groups to existing or proposed pages. Use
      [content-coverage](../skills/content-coverage/SKILL.md) to identify useful
      gaps, weak coverage and overlap. Choose refresh, new page, investigation
      or leave alone; prioritize product fit before search volume
- [ ] Keep important pages accurate as the product and market change:
      capabilities, instructions, comparisons, examples, screenshots, pricing,
      links and sources. Refresh stale answers substantively; do not change a
      date merely to imply freshness
- [ ] Pages offer original, supported value and a clear relevant next step.
      Internal links connect the reader to the next useful answer or workflow;
      remove unsupported claims and consolidate competing pages when justified
- [ ] [seo-audit](../skills/seo-audit/SKILL.md): verify live titles,
      descriptions, canonicals, redirects/status codes, sitemap/robots,
      headings, alt text and structured data against actual visible content
- [ ] Structured data uses the canonical entity identity, with Organization
      and WebSite/app nodes per `tooling/docs/agent-indexing-standard.md`
- [ ] Search Console property and sitemap are configured. Inspect discovery,
      crawl, indexing and Google-selected canonicals for important changed
      pages, not only the homepage. A submission is not proof of indexing
- [ ] Review relevant query–page pairs: impressions, position, CTR, clicks,
      intent and downstream actions. Investigate declines and high-exposure,
      low-click pages before selecting a content, snippet or technical fix
- [ ] Compare complete windows with consistent filters. Separate brand and
      non-brand discovery, relevant and off-intent queries, and concentration
      in a few pages/products. Report qualified visits and useful conversions
      where available; do not equate more pages or impressions with growth

### GEO: earn accurate inclusion in AI answers

- [ ] Maintain consistent product identity and accurate, readable answers on
      owned pages: clear capabilities, limitations, use cases, comparisons,
      documentation and evidence that a reader or engine can verify
- [ ] Agent indexing follows the Fleet contract: `llms.txt`, `/api/ai`,
      markdown alternates, robots/sitemap, name agreement and HEAD/GET parity.
      Use `tooling/templates/agent-surfaces` and
      [agent-ready](../skills/agent-ready/SKILL.md). These support access;
      their presence does not establish citations or recommendations
- [ ] Measure a versioned set of real audience questions, separating neutral
      problem/category/comparison prompts from brand lookup. Record engine,
      surface, date and coverage; distinguish mentions, citations, factual
      accuracy and recommendations. Search ranking is a separate measurement
- [ ] Inspect the actual answers and cited competitor/third-party pages when
      our product is absent, misrepresented or unsupported. Identify the
      specific missing answer, proof, entity signal or access barrier before
      proposing owned-page changes or legitimate third-party contributions
- [ ] Verify authorized changes live, then repeat comparable observations on
      the same prompt set and engine/surface. Review citation and mention
      changes separately from attributable referrals and useful actions;
      keep small samples, failed captures and missing attribution explicit

Use [evidence and exact-edit review](../skills/seo-research/references/opportunity-review.md)
for both lanes. Google's guidance on
[helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
and [AI features](https://developers.google.com/search/docs/appearance/ai-features)
also applies; technical eligibility does not guarantee visibility or growth.

## 7. Analytics + observability

- [ ] Use the existing App Health integration for applicable browser/native
      analytics, source attribution, named product actions, endpoint health
      and intentional logs. Verify each applicable capability, project and
      environment; do not treat it as a pings-only service or build a duplicate
      measurement pipeline. Follow
      [App Health's integration guides](https://github.com/sass-maker/app-health/blob/main/docs/integration-readiness.md)
- [ ] Define meaningful steps from discovery to first successful core task
      and repeated value. Distinguish CTA clicks, completed outcomes, failures,
      repeat events and returning use; collect only privacy-appropriate data
- [ ] Verify accepted events and report readback using bounded, labelled QA:
      correct scope/source/window, retries/deduplication, alert and daily count
      where applicable. Exclude QA from organic demand; source wiring alone
      does not prove delivery or report correctness
- [ ] Microsoft Clarity is configured where applicable, with live collection
      verified via `clarity-fleet-health`; preserve explicit holds and N/A
      decisions. Use it for browser behavior alongside App Health
- [ ] Explicit alertable events use `ping` where useful, such as signup,
      waitlist.join and payment.failed. Verify the selected alert destination
      without adding unrequested external notifications
- [ ] Site Health picks the domain up for performance + Search Console
      collection (follows from the catalog entry; verify, don't assume)
- [ ] Report coverage, freshness, sampling, known bots, unknown automation and
      identity limits. Keep people, browsers, sessions, actions and backend
      requests distinct; qualify exact counts separately. Verify scheduled
      execution and surface failures using the existing operational tooling

## 8. Product acceptance + launch (owner approves the launch plan)

- [ ] Compare promised core workflows with alternatives and category expectations. Record required capabilities, deliberate omissions and actual gaps; prioritize fit and complete useful tasks over feature counts. Do not claim parity from a feature list or mockup.
- [ ] Verify the promised workflow end to end, including applicable signup/install, permissions, input, useful result, save/reopen/export and recovery. Check supported platforms and package/app versions; keep unavailable private/native checks explicit.
- [ ] `test-quality`: a regression test on the core loop
- [ ] Positioning/copy pass (`marketing` skill): claims match what shipped
- [ ] `launch-campaign`: one owner-approved plan; directory runs use its
      launchkit reference (`tooling/launchkit/`). Honest-evidence rules apply
      (`submitted` is not `scheduled` is not `live`)
- [ ] Match distribution to a specific audience and useful demonstrated task.
      Attribute relevant channels through the existing analytics; review visits,
      completed outcomes and feedback. Adapt weak positioning or handoffs from
      evidence instead of counting listings, posts or submissions as adoption

## 9. Post-launch verification

- [ ] `public-product-smoke`: a guest can complete the core loop
- [ ] Performance baseline and relevant budgets recorded (`web-perf`): loading,
      interaction and layout stability on representative devices, routes and
      data. Investigate real regressions; verify optimizations on comparable
      workloads. CI/Lighthouse alone does not prove real-user performance
- [ ] `fleet-deploy-parity`: production matches `origin/main`
- [ ] `PROJECT_STATUS.md` updated to reflect what is actually live
- [ ] GEO tracking: query added to `geo-observatory` scope if the product
      should be measured weekly
- [ ] `content-coverage` audit if the product should grow organic traffic

## 10. Ongoing review and improvement

- [ ] Give applicable areas a named cadence and event-triggered review after
      meaningful product, content or deployment changes. Reuse existing Site
      Health reporting and App Health collection; verify actual execution,
      current coverage and failed/stale streams before interpreting trends
- [ ] For actively maintained products, review collection health, relevant
      acquisition/conversion trends and regressions weekly. Review priority-page
      freshness, keyword/intent and competitive coverage, AI-answer evidence,
      design and core-workflow gaps monthly. Use existing configured measurement
      panels and justify lifecycle-appropriate exceptions; this does not install
      a new routine or enlarge a frozen measurement scope
- [ ] Each review connects observations to a decision: keep, refresh, fix,
      investigate, retire or wait for a defined observation window. Name the
      affected page/workflow, reason, expected outcome and follow-up date;
      complete in-scope repairs rather than only producing another report
- [ ] Maintain freshness, intent fit, competitive coverage, AI-answer accuracy,
      usability, core-workflow parity, performance and reliability; prioritize
      evidenced gaps within the product's intended lifecycle
- [ ] After an authorized release, verify the live change and compare outcomes
      with the recorded baseline. Explain flat/declining results, concurrent
      changes and uncertainty; do not claim causation from a before/after chart
- [ ] Keep unresolved work in the owning repository's existing GitHub Issues
      and update the existing acceptance record. Status reports distinguish
      implemented, live-verified and outcome-reviewed work, with justified
      exceptions and current dates. Checklist completion never means every
      future outcome is guaranteed
- [ ] For scored product work, update the affected private assessment and lever:
      work completed, observed result, dated proof, remaining gate and best next
      action. Keep prior assessments/progress, validate the import, refresh the
      live workspace and export a backup as the scoreboard guide describes

## AI and agent readiness

- [ ] Declare core workflows and promised CLI, API, MCP, agent and browser surfaces; justify each N/A, treat missing promised coverage as a gap, and add no interface the core job does not benefit from.
- [ ] Where promised, document and verify installed CLI version/help, noninteractive stable JSON schema/exit codes, bounded timeouts and errors; discover and call real MCP tools end to end with scoped, revocable auth and explicit read/write boundaries.
- [ ] Align agent instructions and machine contracts with shipped capabilities; test a fresh agent on a shipped core task and negative case, with least privilege, private prompt/data handling, untrusted-input defenses, preview, idempotence, cancellation and recovery.
      Persist dated observed useful-completion and recovery results/receipts with permission scope; separate QA from real use and assess internal tools too. This is cross-category Product/Engineering/Measurement evidence, not GEO or a new score formula.

## Conditional branches

- **iOS / native app**: the public page comes from the `ios-landings`
  factory, not `web-landing`. `apple-native` covers build and QA,
  `apple-release` covers release.
- **LLM-powered product**: follow `tooling/docs/ai-client-standard.md`; set spend, retry and output caps before launch.
- **No public web surface**: public landing/SEO/GEO and Clarity checks can be
  N/A with a cataloged reason. Product design, core usefulness, reliability,
  privacy and appropriate measurement still apply.
