# glm work queue — core Mac apps GEO/SEO (2026-07-18)

Execution list for the GEO/SEO plan in `geo-seo-plan-2026-07.md`. The old
`work-queue-glm-2026-07.md` (G1–G11, 2026-07-17) is closed; this is the next,
deeper layer.

## How to use this doc

- **Spawn one glm agent per task ID.** Each task is self-contained (repo, files,
  steps, acceptance).
- **Parallelize across products** (CV / HP / PT are different repos — no
  conflict). **Within a product, respect the listed order** (later tasks assume
  earlier reachability fixes).
- Tasks marked **[me]** are design-owned — do not hand to glm blind; they have a
  brief here but I finish the design first. Tasks marked **[user]** live in
  `work-queue-browser-2026-07.md`.

## Universal glm guardrails (apply to EVERY task)

1. **Branch + PR.** `git fetch origin && git switch -c <branch> origin/main`.
   Never commit straight to main; never force-push; never leave work on a
   detached/old branch. Open a PR (main is branch-protected → squash-merge).
2. **Green before commit.** Run the repo's build + typecheck + lint (`pnpm build`
   / `pnpm typecheck` / `pnpm lint` or the repo's scripts). Do **not** run
   `biome --write` / autofix blindly — it has broken CI before
   (`noPropertyAccessFromIndexSignature`). Fix only what you touched.
3. **Content guardrail.** Every page anchors to real data/functionality the
   product owns. No generic AI prose. Thin content punishes the whole domain.
4. **Follow** the repo's `AGENTS.md`, `LANDING_STANDARD.md` (marketing), and
   `fleet-ops/docs/agent-indexing-standard.md` (machine surfaces).
5. **Verify machine surfaces** against `fleet-ops/skills/agent-ready/scripts/agent-index-audit.mjs`
   after edits.
6. **Report** exactly what you changed, the branch/PR URL, and CI status.

---

# CodeVetter — repo `codevetter/`, site `apps/landing-page-astro/`

### CV1 — Reachability: index the deep pages · S · do first
Only the homepage is indexed; the benchmark is one buried footer link.
- Surface `/benchmark` in the top nav and in a prominent homepage module (hero
  stats or a dedicated "See the benchmark" CTA), not just the footer.
- Make `/download` a real route link from the homepage nav/CTA (currently the
  button targets the `#download` anchor, so the `/download` route has zero
  internal links).
- Add `BreadcrumbList` JSON-LD to `/benchmark`, `/download`, `/privacy`,
  `/terms`.
- **Accept:** `/benchmark` + `/download` each have ≥1 internal link from the
  homepage body/nav; breadcrumb JSON-LD parses; build green.

### CV2 — Reachability: one sitemap + honest machine surfaces · S · after CV1
- Delete the stale hand-authored `public/sitemap.xml` (keep the Astro
  `sitemap-index.xml` / `sitemap-0.xml`). Ensure `robots.txt` + `api-ai.json`
  both point to the Astro sitemap.
- In `public/api-ai.json`: add `/benchmark` to the surfaces list; **fix the
  false markdown claim** — either generate real `.md` for each route or set
  `markdown.negotiation: false` and drop the `.md` suffix advertising (it 404s
  today).
- **Fix the provider-list inconsistency:** `index.md` says "Claude, Codex,
  Gemini CLI"; FAQ + JSON-LD say "Anthropic, OpenAI, OpenRouter." Pick the
  correct canonical list (confirm against the app's actual backends) and make
  all surfaces agree.
- **Accept:** exactly one sitemap advertised everywhere; `/api/ai` lists
  `/benchmark`; no 404-ing markdown claim; provider list identical across
  `index.md`, FAQ, and JSON-LD.

### CV3 — GEO surfaces surface the benchmark · S · after CV2
`llms.txt`/`llms-full.txt` omit the benchmark — the one asset engines would cite.
- `llms.txt`: link `/benchmark` + the dataset file, and state the local/desktop
  wedge in one line.
- `llms-full.txt`: make it actually full — product summary, the local-first
  differentiator, benchmark headline numbers (29/29 vs raw Claude 27/29) +
  methodology one-liner + dataset link, and the 7 FAQ Q&As inline.
- `index.md`: add a benchmark line.
- **Accept:** `agent-index-audit.mjs` passes; benchmark URL present in all three
  surfaces; llms-full contains the benchmark numbers.

### CV4 — Homepage category signal · S
Per the external analysis: the title/H1 are good marketing but don't state the
category.
- Title → `CodeVetter — Local AI Code Review for Agent-Generated Code`.
- Meta description → "Review and verify AI-generated code locally. CodeVetter
  finds bugs, runs executable QA, validates fixes, and preserves evidence before
  you ship."
- Keep the punchy H1 ("Stop merging unreviewed AI code."), but make the **first
  body paragraph** plainly state: "CodeVetter is a local-first AI code review and
  verification tool for code produced by Claude Code, Codex, Cursor, Devin and
  other coding agents."
- **Accept:** title/meta updated; first paragraph states the category + names
  the agents.

### CV5 — Intent pages (no new data needed) · M · after CV3/CV4
Build the intent pages that lean on the *existing* benchmark + local wedge.
Do **not** build the full competitor roundup here — that needs CV-BENCH data
(see CV6). Each page: unique title/H1/self-canonical, real content anchored to
the benchmark/product, `FAQPage` JSON-LD, internal links from nav/footer.
- `/local-ai-code-review` — the uncontested wedge: review agent code without the
  repo leaving your machine. Explain the desktop-workbench model vs PR-comment
  bots; cite the benchmark.
- `/coderabbit-alternative` — honest positioning as the local/desktop
  alternative (not "better," *different*: local, evidence-backed, one-time
  desktop app). Name what CodeRabbit does better too.
- `/verify-ai-generated-code` — the how-to/problem framing; executable QA + fix
  re-runs + evidence handoff.
- **Accept:** 3 pages build, each unique intent (not keyword-swapped clones),
  FAQPage parses, linked in nav/footer, each references the benchmark.

### CV6 — [me] Competitor benchmark (the moat) · L · design-first
Expand the benchmark to run **CodeRabbit, Greptile, Qodo, Copilot Review,
Semgrep** on the same real agent PRs; measure defects caught / false positives /
duplicate comments / review time / cost / fix-verified; publish every raw
output. Then a `/ai-code-review-tools` roundup page built *from that data*.
- I design the methodology + harness before any execution. glm's role will be
  limited to page scaffolding once the data exists. Left here as a placeholder so
  it's tracked; **do not start as a generic SEO article.**

### CV7 — Trust + credibility fixes (product infra) · M · high priority
- **Signing/notarization:** add Developer ID codesign + `notarytool` +
  `stapler` to `release.yml` for the macOS `.dmg`; add the `.entitlements`.
  Secrets (`APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_PASSWORD`, Developer ID cert)
  come from the user — write the workflow to read them from GitHub secrets and
  no-op with a clear log line if absent. **[user] provides secrets — see B-INFRA.**
- **Telemetry opt-out:** the in-app PostHog capture (`apps/desktop/src/lib/analytics.ts`)
  fires unconditionally — this contradicts the privacy-first positioning. Add a
  first-run consent gate + a Settings toggle (default per user decision; **recommend
  opt-in** for a privacy-marketed tool). Respect it before any `capture`.
- **Accept:** release workflow produces a signed+notarized DMG when secrets
  present; telemetry gated behind explicit consent; privacy page matches actual
  behavior.

---

# HeyPace — repo `pace/`, site `pace/website/`

### HP1 — Reachability: crawl paths for /pricing + /faq · S · do first
- Add real route links to `/pricing` and `/faq` in the homepage nav and footer
  (today they exist only as `#pricing` / `#faq` on-page anchors).
- Add `<lastmod>` to `sitemap.xml.ts` entries.
- (The live sitemap is also stale — omits `/pricing`, `/faq`. That's fixed by a
  redeploy → **[user] B-DEPLOY**.)
- **Accept:** `/pricing` + `/faq` linked as routes from home; build's sitemap
  includes all 20 URLs with lastmod.

### HP2 — Mainstream comparison pages (the demand) · M · after HP1
The 13 existing `/compared/<slug>` pages target low-volume indie repos. Add the
high-demand names Pace already invokes on its homepage.
- Extend `src/config/competitors.ts` with honest, accurate entries for **Siri,
  Raycast, Wispr Flow, MacWhisper, Superwhisper** (posture, license, stt/reasoner/
  tts, standout features, where-Pace-is-behind). Keep the candor — name what each
  does better.
- The `[slug].astro` template already renders these fields; verify each new page
  builds with unique title/H1/self-canonical.
- **Accept:** `/compared/{siri,raycast,wispr-flow,macwhisper,superwhisper}` build
  with unique metadata + an honest "where Pace is behind" section each.

### HP3 — Machine-readable comparisons · S · after HP2
Comparison pages carry only `BreadcrumbList`; the rich `competitors.ts` fields
render as prose only.
- Emit `FAQPage` JSON-LD on each `/compared/<slug>` page from the key
  comparison Q&As (e.g. "Is Pace better than X?", "Does Pace run on-device?",
  "How much is Pace vs X?").
- Add `ItemList` + `BreadcrumbList` JSON-LD to the `/compared` hub.
- **Accept:** each vs-page emits FAQPage that parses; hub emits ItemList.

### HP4 — GEO surfaces surface price + comparisons · S · after HP3
`llms.txt`/`llms-full.txt`/`index.md`/`api-ai.json` omit the $29 price and the
comparisons — the two most citable facts.
- Put the on-device wedge, the **$29 one-time price**, and the `/compared` hub +
  the honest "where Pace is behind" summary into `llms.txt` + `llms-full.txt`.
- `api-ai.json`: enumerate `/compared`, `/pricing`, `/faq` as surfaces.
- **Accept:** price + comparison hub present in llms.txt/full; `/api/ai` lists
  the three surfaces; `agent-index-audit.mjs` passes.

### HP5 — [me] On-device benchmark (the proof asset) · L · design-first
An original, reproducible benchmark: latency (time-to-action), what data leaves
the device (privacy), and offline capability vs cloud Mac assistants
(Superwhisper/Dottie/Shadow/Siri). Published as a crawlable page + downloadable
data + `Dataset` JSON-LD — the citable data source Pace lacks. I design the
methodology; glm builds the page from the data.

### HP6 — Feedback + trust (product infra) · M
- Add a `.github/ISSUE_TEMPLATE/` (bug + feature) and an in-app "Send feedback"
  affordance (a menu item opening a prefilled mailto or a lightweight form).
- **Signing in CI:** move the conditional notarization from `scripts/release-pace.sh`
  into the release workflow (read `PACE_DEVELOPER_ID` / `PACE_NOTARY_PROFILE`
  from secrets; ship a **notarized `.dmg`**, not an ad-hoc `.zip`). **[user]
  provides secrets — B-INFRA.**
- **Accept:** issue templates present; in-app feedback path works; release
  workflow notarizes + ships a DMG when secrets present.
- **Note [user]:** the $29 checkout is a `mailto:` with hand-sent keys and the
  app has no license enforcement — commerce/licensing is a product decision, see
  B-INFRA.

---

# PostTrainLLM — repo `posttrainllm/`, site `posttrainllm/browser/`

### PT0 — [user] Redeploy · UNBLOCKS EVERYTHING · B-DEPLOY
The live site is a stale build. A redeploy of current source recovers:
`/data/leaderboard.json` + `.csv` (serve HTML today), the RSS feed, extensionless
canonicals, and the `Dataset` JSON-LD. **Do this before PT reachability work is
verified live.** (In browser queue.)

### PT1 — TinyGPT rebrand pass · M · needs care (touches core source)
~149 files + the live GitHub link still say "TinyGPT."
- Rename user-facing "TinyGPT" → "PostTrainLLM" across `browser/src/content/docs/`
  (~149 files), core source references, and **fix the GitHub link**
  (`github.com/PostTrainLLM/tinygpt` → the correct repo, 4× on homepage +
  elsewhere).
- **Public asset filenames** (`tinygpt.js/.wasm`, `tinygpt64.js/.wasm`,
  `demo.tinygpt`) must be renamed **and all references updated atomically** — a
  mismatch breaks the WebGPU app load. Grep for every reference before renaming.
- **Accept:** zero "tinygpt" in user-facing content + correct GitHub link; build
  green; **the WebGPU playground still loads and trains** (verify in a local
  preview, not just a build pass).

### PT2 — Devlog → per-entry collection · M · the SEO engine unlock
14 strong entries are trapped on one URL; RSS is broken; no `Article` schema.
- Convert `devlog.astro` (14 `<h2>` entries) into an Astro content collection
  with per-entry routes `/devlog/[slug]`, each with `BlogPosting`/`Article`
  JSON-LD, real `datePublished`, and an entry in the sitemap.
- Rebuild `/devlog` as an index linking all entries; ensure `devlog/rss.xml.ts`
  emits all 14 items.
- **Accept:** 14 indexable devlog URLs, each with Article JSON-LD + in sitemap;
  RSS lists 14 items; index links them.

### PT3 — Canonical + sitemap hygiene · S
- Fix `playground.astro:14` — it passes `ogUrl:"https://posttrainllm.com"` which
  overrides the canonical to root (`Default.astro` does `href={ogUrl ?? canonical}`).
  Make the playground canonical self-referential.
- Delete the stale `public/sitemap.xml` (319 URLs); keep the generated
  `sitemap-index.xml`. Ensure canonicals are extensionless to match the sitemap.
- **Accept:** `/playground` canonical = `/playground`; one sitemap; canonicals
  and sitemap agree (extensionless).

### PT4 — GEO surfaces surface leaderboard + artifacts + docs · S · after PT3
- `llms.txt`/`llms-full.txt`/`index.md`: surface the **leaderboard**, the 11
  **artifacts**, the `docs/learn` corpus, and the MLX/Mac + WebGPU angle. Fix the
  `/devlog.html` link → extensionless.
- `api-ai.json`: enumerate leaderboard, artifacts, docs surfaces.
- **Accept:** leaderboard + artifacts + docs present in surfaces;
  `agent-index-audit.mjs` passes.

### PT5 — Tutorial intent pages (from existing material) · M · after PT1
Reframe existing recipes/artifacts into tutorial-shaped landing pages for the
winnable queries. Lead with the **in-browser WebGPU** wedge (uncontested).
- `/train-llm-in-browser` (WebGPU fine-tuning — the wedge; vs inference-only
  WebLLM/Transformers.js).
- `/fine-tune-llm-on-mac` (MLX LoRA/QLoRA on Apple Silicon — tutorial-framed,
  anchored to the real recipes + leaderboard numbers).
- Each: `TechArticle` JSON-LD, unique title/H1/canonical, internal links,
  anchored to real recipes/artifacts (no generic prose).
- **Accept:** 2 tutorial pages build with TechArticle schema, linked from nav.

### PT6 — Leaderboard as a citable dataset · S · after PT0 (redeploy)
- Add `ItemList` JSON-LD to the leaderboard rankings.
- Ensure the leaderboard table is **server-rendered** (it currently fetches
  `/data/leaderboard.json` client-side, so crawlers see ~251 words + headers).
  Render the rows at build time from the JSON so the data is in the HTML.
- **Accept:** leaderboard HTML contains the ranked rows (view-source) + ItemList
  + the existing Dataset JSON-LD.

### PT7 — Clean up dead telemetry ref · XS
`browser/src/lib/vitals.ts` beacons to `https://vitals.fleet.workers.dev/collect`,
a Worker that doesn't exist. Remove the dead fallback (PostHog handles vitals).
- **Accept:** no reference to the non-existent collector; vitals still captured
  via PostHog.

### PT8 — [user] Positioning honesty
`native-mac/` is a dev-only SwiftPM build (no installable Mac app); the web app
is the real product. Decide whether to build a real Mac app or adjust the
"Mac-local" framing so the site/README/registry match what a user can actually
install. Product decision — see B-INFRA.

---

# Cross-cutting — off-site + brand (Pillar 4)

### X1 — Awesome-list PR drafts · S each · glm drafts → [user] submits
For each product, fork the target list, add a correctly-formatted entry, and
prepare the PR (branch + description) for the user to submit under their GitHub
identity. Do **not** submit — hand back the fork URL + diff.
- CodeVetter → `kodustech/awesome-ai-code-review`, `joho/awesome-code-review`,
  `sourcegraph/awesome-code-ai`.
- HeyPace → `jaywcjlove/awesome-mac`, `serhii-londar/open-source-mac-os-apps`,
  `iCHAIT/awesome-macOS`.
- PostTrainLLM → `raullenchai/awesome-mlx`, `antranapp/awesome-mlx`, and the
  MLX community-projects thread `ml-explore/mlx/discussions/654`.
- **Accept:** one prepared entry per list, matching the list's format, factually
  exact, ready for the user to push.

### X2 — GitHub Topics + repo README polish · S · glm drafts → [user] applies
Draft the GitHub Topics per repo (e.g. CodeVetter: `ai-code-review`,
`code-review`, `local-first`, `tauri`; HeyPace: `voice-assistant`,
`ai-voice-agent`, `macos-app`, `on-device`; PostTrainLLM: `mlx`, `webgpu`,
`fine-tuning`, `apple-silicon`) and any README additions that state the wedge in
the first paragraph (LLMs read READMEs).
- **Accept:** topic list + README-intro diff per repo, ready to apply.

### X3 — Brand disambiguation · S
Make each product's entity crisp so brand queries don't resolve to the
collision (CodeVet/CodVerter; PostTrainBench; generic "Pace").
- Ensure `WebSite` + `Organization` JSON-LD with `sameAs` (GitHub, any social)
  on each homepage; consistent exact product name + one-line descriptor
  everywhere (site, README, registry, machine surfaces).
- **Accept:** identical name + descriptor across all surfaces per product;
  Organization/WebSite JSON-LD present with sameAs.

### X4 — [me] Show HN + outreach evidence packages
Draft posts (Show HN for CodeVetter benchmark, HeyPace $29 Mac tool,
PostTrainLLM browser-training) and the roundup-author outreach email (the
"would you test it for the next update, here's a reproducible benchmark" frame).
I own the framing; **[user]** posts/sends — see B-LAUNCH.

---

# Analytics (Pillar 5)

### AN1 — Privacy-friendly web analytics on CodeVetter + HeyPace · S
Both ship zero web analytics. Add **Cloudflare Web Analytics** (cookieless, no
client PII — fits the on-device positioning; all three sites are on CF Pages) to
CodeVetter and HeyPace. (PostTrainLLM already has PostHog with opt-out — leave.)
- **Accept:** CF Web Analytics beacon live on both; no cookies added; privacy
  pages still accurate.

### AN2 — Expand GEO Observatory to the full query universe · S
`fleet-ops/config/geo-observatory.json` has only 2 queries per core product.
- Add the comparison + how-to queries from the query-universe map for CodeVetter,
  HeyPace, PostTrainLLM (see the plan doc / footprint report). Then run a fresh
  baseline via `fleet-ops/scripts/geo-observatory-record.mjs`.
- **Accept:** ≥6 queries per core product in config; a new baseline run appended
  to the ledger; `geo-observatory-latest.md` regenerated.

### AN3 — [user] GSC + Bing + AI-referral segments · B-MEASURE
GSC + Bing verification on codevetter.com, heypace.app, posttrainllm.com; submit
sitemaps. Add an "AI referrals" segment (utm_source=chatgpt.com etc.) once
analytics is live. In browser queue.

---

# Product infra — user decisions (summary; details in browser queue B-INFRA)

- **Apple Developer signing secrets** for CodeVetter (CV7) + Pace (HP6) CI.
- **CodeVetter telemetry consent default** (recommend opt-in).
- **Pace commerce/licensing** ($29 app currently unenforced) — Gumroad/Stripe/
  Paddle + StoreKit or license-key validation.
- **PostTrainLLM Mac-app vs web-only positioning** (PT8).
- **Email capture** — optional; recommend Buttondown (privacy-friendly) if wanted.
- **Homebrew casks** for CodeVetter + HeyPace (distribution + trust) — glm can
  draft the cask formulae once signed artifacts exist.
