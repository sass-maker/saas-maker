# Browser work queue — GEO/SEO (2026-07-17)

Tasks that need a browser (dashboards, signups, form flows). Each is written
to be executed by a computer-use agent (Claude extension / Codex computer
use) with a human signed in. Ordered by impact. Verification commands run in
any fleet shell.

Companion queues: `work-queue-glm-2026-07.md` (writing/code),
`audit-report-geo-seo-2026-07-17.md` (evidence for all of this).

## B1 — Disable Cloudflare AI-bot block (2 zones) · 5 min · UNBLOCKS 13 HOSTS

- URL: https://dash.cloudflare.com → zone **sassmaker.com** → Security →
  Settings (or Security → Bots). Find "Block AI bots" / "AI Scrapers and
  Crawlers" / managed robots.txt ("Content Signals") and set to **off /
  allow**. Repeat for zone **significanthobbies.com**.
- Do NOT touch other bot-fight settings.
- Verify (expect NO `Disallow: /` under GPTBot/ClaudeBot groups):
  `curl -s https://sassmaker.com/robots.txt | grep -A2 -i gptbot`
  `curl -s https://significanthobbies.com/robots.txt | grep -A2 -i claudebot`
  Then: `node fleet-ops/skills/agent-ready/scripts/agent-index-audit.mjs --all`
  → the 13 `ai-ok ✗` hosts should flip to ✓.

## B2 — Google Search Console: 7 domain properties + sitemaps · ~30 min

- URL: https://search.google.com/search-console → Add property → **Domain**
  type, for each of: `sassmaker.com`, `significanthobbies.com`,
  `highsignal.app`, `rolepatch.com`, `codevetter.com`, `karte.cc`,
  `posttrainllm.com`. (Domain property covers all subdomains — do NOT add
  per-subdomain properties.)
- Each gives a DNS TXT record → add in Cloudflare dash (DNS → Records →
  Add → TXT, name `@`). Verify in GSC after propagation (~minutes).
- Then per property, Sitemaps → submit:
  - sassmaker.com: `https://sassmaker.com/sitemap-index.xml`,
    `https://docs.sassmaker.com/sitemap-index.xml`,
    `https://domains.sassmaker.com/sitemap.xml`,
    `https://mail.sassmaker.com/sitemap.xml`,
    `https://ai-gateway.sassmaker.com/sitemap.xml`,
    `https://performance.sassmaker.com/sitemap.xml`
  - significanthobbies.com: apex `sitemap.xml` + materia/anime/tv/chess/
    read/learn subdomain sitemaps (read + learn only AFTER their redeploy)
  - highsignal.app: `https://highsignal.app/sitemap.xml`,
    `https://ratings.highsignal.app/sitemap.xml`,
    `https://papers.highsignal.app/sitemap.xml`
  - rolepatch.com: apex + `https://truehire.rolepatch.com/sitemap.xml`
  - codevetter.com: apex sitemap-index + `starboard.codevetter.com/sitemap.xml`
  - karte.cc, posttrainllm.com: apex sitemaps
- **heypace.app: deferred** — add property + sitemap only after the pace
  redeploy (its live surfaces still advertise pages.dev URLs until then).
- Verify: GSC shows "Success" per sitemap within a day.

## B3 — Bing Webmaster Tools import · 5 min

- URL: https://www.bing.com/webmasters → sign in → "Import from GSC".
  One click imports all verified GSC properties + sitemaps. Gives index
  coverage for the engine behind ChatGPT search / DuckDuckGo.
- Verify: properties listed in BWT dashboard.

## B4 — Cloudflare Crawler Hints + www redirects · 15 min

For each zone (sassmaker.com, significanthobbies.com, highsignal.app,
rolepatch.com, codevetter.com, karte.cc, posttrainllm.com, heypace.app):
- **Crawler Hints**: Caching → Configuration → Crawler Hints → ON.
  (Free; auto-fires IndexNow on content change — replaces manual re-runs.)
- **www→apex redirect**: Rules → Redirect Rules → create
  `www.<zone>/*` → `https://<zone>/$1`, 301, preserve query. (Skip
  karte.cc — www has no DNS record; either add record+rule or leave.)
- Verify: `curl -sI https://www.rolepatch.com/ | head -3` → 301 to apex.

## B5 — llms.txt / AI-agent directories · 20 min · on-thesis submissions

Submit the flagship products (codevetter, rolepatch, sassmaker, materia,
posttrainllm, highsignal) with their `https://<host>/llms.txt` URLs to:
- https://llmstxt.site (form/PR flow)
- https://directory.llmstxt.cloud
- Any "AI agent-ready site" directories encountered (judgment: skip
  paywalled/spammy ones — see directory-submissions.md lessons).
- Verify: listing URLs recorded in `fleet-ops/config/directory-submissions/`.

## B6 — Directory spray follow-up · 10 min · after 2026-07-31

- Visit insidr.ai, paggu.com, techpluto.com, thestartupinc.com listings/
  search for "CodeVetter", "RolePatch", "sassmaker". Record which of the 113
  heuristic-confirmed submissions actually published.
- Known bug to check: Insidr submissions may have URL in the name field and
  categories in the email field — if listings are absent, that's why; one
  manual resubmit of the 3 focus products is worth it, mass resubmit is not.

## B7 — Enable the weekly GEO Observatory routine · 5 min · UNBLOCKS MEASUREMENT

- 1: connect GitHub to claude.ai (Settings → Connectors / account settings).
- 2: install the Claude GitHub App on **sass-maker/fleet-workspace**:
  https://claude.ai/code/onboarding?magic=github-app-setup
- 3: tell any Claude Code session "create the geo-observatory routine from
  fleet-ops/skills/geo-observatory/routine.json" (runs Mondays 08:00 IST;
  baseline is already seeded, so run 1 shows deltas).
- Verify: routine listed at https://claude.ai/code/routines

## B8 — Hugging Face org for PostTrainLLM · 10 min browser + CLI handoff

- URL: https://huggingface.co/organizations/new → create org `PostTrainLLM`
  (avatar from repo favicon, website https://posttrainllm.com).
- Model card content + upload commands come from glm task G4; actual upload
  is CLI (`huggingface-cli upload`), not browser.

## B9 — Launches · needs the human present, schedule deliberately

Not computer-use tasks — attention is the product. Queue when assets ready:
1. **Show HN: CodeVetter benchmark** (after glm G1 ships the benchmark page).
   Post ~9am ET weekday; be available 3–4h for the thread.
2. **Materia** write-up → HN/reddit (r/nutrition, r/askscience-adjacent
   subs have strict self-promo rules — read them first).
3. Product Hunt for pace/codevetter — only after pricing pages + OG images
   are live (glm G3), otherwise wasted launch.

---

# Core-app GEO/SEO tasks (added 2026-07-18)

Tied to `geo-seo-plan-2026-07.md` + `work-queue-glm-core-2026-07.md`. These are
the user/browser-only items that gate or complement the glm execution list.
Named to match the cross-references in the glm doc.

## B-DEPLOY — Redeploy the three core sites · UNBLOCKS a lot

Production deploys are manual. Deploy current `origin/main` for each once the
matching glm PRs merge:
1. **PostTrainLLM (do first, standalone win):** the live site is a stale build.
   A redeploy alone recovers `/data/leaderboard.json`, the RSS feed,
   extensionless canonicals, and the `Dataset` JSON-LD — no code change needed.
2. **HeyPace:** redeploy after HP1 merges so the sitemap includes `/pricing` +
   `/faq` (live sitemap is currently stale at 18 URLs).
3. **CodeVetter:** redeploy after CV1–CV4 merge.
Verify each with `curl` on the named surfaces after deploy.

## B-MEASURE — Search Console + Bing + AI-referral segments

Focuses B2/B3 on the three core domains (do these first of the 7):
- GSC property + sitemap submit for `codevetter.com`, `heypace.app`,
  `posttrainllm.com`. Request indexing for the homepage + benchmark/leaderboard.
- Bing Webmaster import for the same three.
- After AN1 ships analytics, add an "AI referrals" segment
  (`utm_source=chatgpt.com`, `perplexity.ai`, `gemini`, referrer contains the
  AI hosts) so you can see which pages answer engines send traffic to.

## B-LAUNCH — First citable third-party URLs (the real GEO lever)

Extends B9. These create the third-party consensus LLMs cite. Order:
1. **Submit the awesome-list PRs** glm prepared (X1) — one per target list, under
   your GitHub identity.
2. **AlternativeTo + Product Hunt** entries for CodeVetter + HeyPace (Pace as an
   alternative to Superwhisper/Raycast/Siri/Dottie; CodeVetter as a local
   CodeRabbit/Greptile alternative).
3. **Populate the HF org** (extends B8): publish the leaderboard models publicly
   at `huggingface.co/PostTrainLLM` — instant proof + citation surface (currently
   empty). Upload via `huggingface-cli upload`.
4. **r/LocalLLaMA** posts — best-fit sub for all three (local/on-device angle).
5. **Outreach** to roundup authors with the evidence package (X4) — "would you
   test it for the next update, here's a reproducible benchmark."
6. **Show HN — ON HOLD (2026-07-18):** not posting to HN for now. Drafts stay
   ready in the evidence-package doc; unpark when you decide to launch.

## B-INFRA — Product-infra decisions (gate the trust/commerce fixes)

- **Apple Developer signing:** provide `APPLE_ID`, `APPLE_TEAM_ID`,
  `APPLE_APP_PASSWORD`, and the Developer ID cert as GitHub secrets for
  CodeVetter (CV7) and Pace (HP6) so CI can ship signed+notarized DMGs.
  CodeVetter currently ships an **unsigned DMG** → Gatekeeper blocks normal users.
- ~~CodeVetter telemetry default~~ — **DECIDED 2026-07-18: opt-in (default
  OFF).** glm (CV7) implements the consent gate; no capture until opt-in.
- **Pace commerce — DECIDED (Lemon Squeezy):** create a Lemon Squeezy store, add
  a **$29 one-time** product, enable **license keys**, and get the API key (for
  HP7's in-app activation). LS is merchant-of-record so it handles global
  VAT/tax. This replaces the mailto checkout.
- ~~PostTrainLLM positioning~~ — DECIDED: web-app-first (PT8, glm). No action for
  you beyond confirming you don't want to build a real Mac app right now.
- **Apple proof-asset accounts (for CV6):** CodeRabbit trial, Greptile trial,
  Copilot review (existing sub), Qodo via OSS PR-Agent, Semgrep free — on a test
  repo. Only needed when we run the competitor benchmark.
- **HeyPace benchmark rig (for HP5):** a clean Apple-Silicon Mac + Superwhisper/
  Wispr/Dottie/Shadow installed + Little Snitch. Only needed for the on-device
  benchmark run.
- **Homebrew casks:** once signed artifacts exist (post-Apple-account), glm
  drafts casks for CodeVetter + HeyPace; you tap/submit them.
- ~~Email capture~~ — SKIPPED for now.

## Done / not needed

- GitHub repo topics: done 2026-07-17 (all 21 repos). (X2 refines the core-three
  topics toward the GEO query terms — verify current topics before re-applying.)
- IndexNow initial submit: done (1057 URLs, 202s); Crawler Hints (B4)
  automates the future.
- Google Indexing API: NOT applicable (jobs/livestream only).
