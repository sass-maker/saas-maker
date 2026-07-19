# GEO + SEO growth plan — core Mac apps (2026-07-18)

Master strategy for making **CodeVetter**, **HeyPace**, and **PostTrainLLM**
surface when people ask LLMs relevant questions, and rank in search over time.
Grounded in a six-agent audit (2026-07-18): three per-product SEO/GEO deep
dives, an LLM query-universe + third-party-footprint map, an analytics
instrumentation audit, and a Mac-app product-infra audit.

Companion docs:
- `work-queue-glm-core-2026-07.md` — spawnable glm tasks (the execution list).
- `work-queue-browser-2026-07.md` — user/browser-only tasks (GSC, outreach,
  Product Hunt, Apple Developer, HF org).
- `audit-report-geo-seo-2026-07-17.md` — prior fleet-wide evidence.

---

## The one fact that reframes everything

**All three are invisible, not weak.** Every repo is real, actively developed,
strong READMEs. Every one has **0–1 GitHub stars and zero third-party
footprint** — no listicle, awesome-list, Reddit/HN thread, or directory names
any of them. An LLM asked *"best local code review tool"* today has literally
nothing to cite.

So the bottleneck is **distribution and discoverability**, not quality. This
changes the order of operations: the first lever isn't "write more content,"
it's "make the good content reachable, then get the first ~10 citable
third-party URLs to exist at all."

## How an LLM decides to name you (the model behind the plan)

An LLM recommending a product for a category query is downstream of
**third-party consensus** — GitHub, Reddit, HN, comparison articles,
awesome-lists, Product Hunt — far more than anything on your own domain. Your
own `llms.txt`/JSON-LD mostly wins the **branded** query ("what is CodeVetter").
So the plan runs two engines at different speeds:

- **GEO (weeks):** win branded + comparison queries now. Crisp, citable answer
  pages; `Dataset`/`FAQPage`/`SoftwareApplication` schema; each product's
  **proof asset** made crawlable and quotable. This is what makes an engine say
  the right thing *once it's already looking at you*.
- **SEO + off-site (months):** win category/discovery queries. Indexing, a
  topical content engine (devlog/tutorials), and deliberate placement in the
  third-party sources LLMs cite. This is the compounding one, and it's where the
  "we come up unprompted" outcome actually lives.

## The repeatable template (applies to every product, not just these three)

1. **Proof asset** — one original, reproducible data artifact the product owns,
   published as a crawlable HTML page + downloadable data + `Dataset` JSON-LD.
   This is the thing every roundup *has to* cite. Own the design of this; don't
   delegate it blind.
2. **Intent pages** — one page per real search intent (comparison, "X
   alternative", how-to), each solving a genuinely different problem, each
   anchored to the proof asset. Never keyword-swapped clones.
3. **Reachability** — nav/home internal links to every important page, one
   sitemap, machine surfaces (`llms.txt`/`llms-full.txt`/`/api/ai`) that
   actually surface the proof asset and the intent pages.
4. **Get cited** — awesome-list PRs, AlternativeTo/Product Hunt, one Show HN or
   r/LocalLLaMA post, and evidence-package outreach to the authors of the
   roundups that already rank. Ask *"would you test it for the next update,
   here's a reproducible benchmark"* — never *"please add my product."*
5. **Measure** — LLM-answer monitoring (GEO Observatory), AI-referral tracking,
   GSC/Bing coverage, privacy-friendly on-site analytics. Close the loop.

## The five pillars

| # | Pillar | Speed | Owner mix |
|---|---|---|---|
| 1 | **Reachability** — internal links, sitemaps, canonicals, GEO surfaces | days | glm |
| 2 | **Proof assets** — original benchmarks/leaderboards, the citation magnets | weeks | me (design) → glm (build) |
| 3 | **Intent pages** — comparison/alternative/how-to pages anchored to proof | weeks | glm (from tight briefs) |
| 4 | **Off-site + brand** — awesome-lists, directories, Show HN, outreach, disambiguation | weeks–months | glm drafts → user submits |
| 5 | **Product infra + analytics** — feedback, auto-update, signed DMG, distribution, telemetry, LLM-answer monitoring | ongoing | mixed |

---

## Per-product strategy (one screen each)

### CodeVetter — https://codevetter.com
- **Wedge (uncontested):** local/desktop AI code review where *the repo never
  leaves the machine*. Tier-A "AI code review" is saturated (CodeRabbit,
  Greptile, Qodo, Sonar); the desktop-workbench + local niche has no named
  incumbent — own it.
- **Proof asset:** the code-review benchmark — already excellent (27 hand-labeled
  cases, CC0, valid `Dataset` JSON-LD, CodeVetter 29/29 vs raw Claude 27/29).
  The moat move is expanding it to run **competitors** (CodeRabbit, Greptile,
  Qodo, Copilot Review, Semgrep) on the same real agent PRs and publishing every
  raw output. That page becomes "the source every roundup cites."
- **Top problems:** only the homepage is indexed; benchmark is one buried footer
  link; two conflicting sitemaps; benchmark absent from every machine surface;
  `/api/ai` advertises markdown negotiation that 404s; provider list disagrees
  across surfaces.
- **Brand hazard:** CodeVet (codevet.dev) + CodVerter intercept brand queries.

### HeyPace — https://heypace.app
- **Wedge:** the intersection nobody owns — **local voice + reads your screen +
  takes actions + $29 one-time.** Dictation tools (Superwhisper/Wispr) and
  screen-agents (Dottie/Shadow) are separate axes; Pace is the overlap.
- **Proof asset (to build):** an original **on-device benchmark** — latency,
  privacy (what leaves the device), offline capability vs cloud Mac assistants.
  Pace has honest comparison *prose* but no citable *data source*; this is the
  biggest gap to close.
- **Top problems:** 13 comparison pages target low-volume indie repos, **none**
  for the high-demand names Pace itself invokes (Siri, Raycast, Wispr Flow,
  MacWhisper); live sitemap stale (missing `/pricing`, `/faq`); `/pricing` +
  `/faq` reachable only as `#anchors`; GEO files omit the $29 price and the
  comparisons; comparison pages carry only `BreadcrumbList`.
- **Brand hazard:** "Pace" is generic — always anchor on "heypace" / "voice
  agent that reads your screen."

### PostTrainLLM — https://posttrainllm.com
- **Wedge:** **in-browser WebGPU fine-tuning** (the playground) — the thinnest,
  most winnable space; MLX-on-Mac fine-tuning is crowded (MLX, Unsloth, Axolotl)
  but the browser-training angle is near-empty.
- **Proof asset:** the model leaderboard (tiny specialist models, browser-trained,
  ranked) — but it's **broken live** (see below) and its models aren't published.
- **Top problems (severity-ordered):**
  1. **Stale deploy** — live serves the HTML homepage for
     `/data/leaderboard.json`, RSS returns HTML, canonicals point to `.html`,
     `Dataset` JSON-LD absent live. *A redeploy alone recovers all of this.*
  2. **~149 files + the live GitHub link still say "TinyGPT"** — entity dilution.
  3. **Devlog is 14 strong entries trapped on one URL** — can't rank for 14
     queries; RSS broken; no `Article` schema.
  4. **HF org `huggingface.co/PostTrainLLM` is empty** — publishing the
     leaderboard models is an instant proof + citation surface.
  5. `/playground` canonical points to root (source bug); two sitemaps.
- **Brand hazard:** **PostTrainBench** (arXiv, cited) owns the "PostTrain*"
  namespace and intercepts every brand query — disambiguation is mandatory.

---

## Global priority order

1. **PostTrainLLM redeploy** — recovers leaderboard, RSS, canonicals, Dataset
   schema for free (browser/deploy).
2. **Reachability fixes** on all three (Pillar 1) — cheap, days, unlocks indexing.
3. **GEO surface enrichment** (Pillar 1) — make the proof assets visible to
   answer engines.
4. **First citable URLs** (Pillar 4) — awesome-list PRs + AlternativeTo +
   GitHub Topics + one Show HN each. This is what actually gets LLMs to cite.
5. **Intent pages** (Pillar 3) — anchored to proof assets.
6. **Proof-asset expansion** (Pillar 2) — the competitor benchmark (CodeVetter),
   the on-device benchmark (HeyPace), publishing HF models (PostTrainLLM).
7. **Analytics loop + product infra** (Pillar 5) — continuous.

## Ownership model

- **glm** (spawnable, `work-queue-glm-core-2026-07.md`): all reachability fixes,
  GEO-surface rewrites, intent-page drafts from tight briefs, JSON-LD emission,
  the rebrand pass, devlog-to-collection refactor, awesome-list PR drafts.
- **user/browser** (`work-queue-browser-2026-07.md`): deploys, GSC/Bing, Apple
  Developer signing, HF org population, Product Hunt/AlternativeTo, Show HN,
  awesome-list PR submission, outreach sends.
- **me:** proof-asset design (competitor benchmark, on-device benchmark),
  analytics-loop wiring, outreach evidence packages, cross-repo judgment.
