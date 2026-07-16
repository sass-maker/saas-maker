# Domain rating launch kit

Ready-to-post copy for Phase 3 distribution. All links point at **custom domains**, not `*.pages.dev` / `*.workers.dev`.

Track DR weekly in psi-swarm `/projects` after `serve` is running.

## 1. CodeVetter — Show HN (week 5)

**Title:** Show HN: CodeVetter – desktop code review for agent-generated diffs

**URL:** https://codevetter.com

**Comment (first reply):**

> Local-first Tauri app. Reviews run on your machine via Claude/Codex/Gemini CLIs — no central server for your repo.
>
> Building a public benchmark of agent PRs with hand-labeled bugs: https://codevetter.com/benchmark
>
> macOS download: https://codevetter.com/download · GitHub: https://github.com/Codevetter/codevetter

## 2. High Signal — finance / builder Twitter (week 6)

**Hook:** Public hit-rate ledger on market calls — not vibes.

**URL:** https://highsignal.app/track-record

**Thread outline:**

1. Screenshot of track record page
2. "Every signal type shows historical hit-rate inline"
3. Link methodology: https://highsignal.app/methodology
4. Free daily brief, no signup: https://highsignal.app

## 3. SaaS Maker — Indie Hackers / dev blog (week 4)

**Status:** Devlog live at https://sarthakagrawal.dev/blog/fleet-performance-without-argo · case study at https://sassmaker.com/case-study/fleet-performance

**Title:** How I run 23 products on Cloudflare without Argo

**Primary URL (share this):** https://sarthakagrawal.dev/blog/fleet-performance-without-argo

**Case study URL:** https://sassmaker.com/case-study/fleet-performance

**One-liner:** Astro overlays for marketing `/`, psi-swarm for distributional LCP, Workers for apps.

**Tweet / thread hook:**

> 23 sites on Cloudflare. Custom domains were 2–3× slower than *.workers.dev on TTFB.
>
> Closed desktop LCP p75 under 500 ms on five of them without Argo — static Astro overlays, self-hosted fonts, killed opacity-0 hero animations, distributional Lighthouse via psi-swarm.
>
> Write-up: https://sarthakagrawal.dev/blog/fleet-performance-without-argo

## 4. Directory listings (week 7–8)

Submit these URLs (copy-paste fields):

| Product | URL | Category |
|---------|-----|----------|
| CodeVetter | https://codevetter.com | Developer Tools / Code Review |
| RolePatch | https://rolepatch.com | Career / AI Writing |
| High Signal | https://highsignal.app | Finance / Market Research |

**RolePatch tools hub (linkable):** https://rolepatch.com/tools

## 5. GitHub repo homepage fields

**Status:** Set via `gh repo edit` on all seven custom-domain repos (2026-06-10).

Set **About → Website** on each repo:

| Repo | Homepage |
|------|----------|
| saas-maker | https://sassmaker.com |
| CodeVetter | https://codevetter.com |
| high-signal | https://highsignal.app |
| resume-tailor | https://rolepatch.com |
| ai-game | https://aliveville.com |
| significanthobbies | https://significanthobbies.com |
| portfolio | https://sarthakagrawal.dev |

## 6. What still needs you

- Post Show HN / Product Hunt (requires your accounts)
- Submit AlternativeTo / SaaSHub listings (manual forms)
- Attach `sarthakagrawal.dev` custom domain in Cloudflare Pages if not already routed
- Deploy each repo after these commits land (showcase, codevetter landing, aliveville, etc.)

---

## EOY 2026 goal — DR 20 across the fleet

**North star:** all seven owned domains at **DR ≥ 20** by **2026-12-31**.

**Today (2026-06-10):** ~0 on six domains, 0.3 on High Signal. Foundation + first devlog + GitHub homepages are done. DR will not move until external links land and Ahrefs recrawls (2–6 week lag).

### Honest odds

| Outcome | Likelihood | Notes |
|---------|------------|-------|
| **All 7 at DR 20** | Low (~15–25%) | Needs 7 distinct launch moments + sustained citations; solo bandwidth is the bottleneck |
| **Hubs DR 18–25, products DR 10–18** | Medium (~50%) | Achievable if every month ships one launch + one linkable asset |
| **Fleet average DR ~12–15** | High (~70%) | Minimum win if directories + devlog + 2–3 strong launches execute |

Treat **referring domains** as the leading indicator (Ahrefs Site Explorer → Backlinks). DR follows links; psi-swarm weekly DR is the lagging scoreboard.

### Per-domain targets (Dec 31)

| Domain | Jun baseline | EOY target | Primary link magnet |
|--------|-------------:|-----------:|---------------------|
| sassmaker.com | 0 | 20 | Case study + fleet roundup page |
| sarthakagrawal.dev | 0 | 20 | Devlog series + `/projects` hub |
| codevetter.com | 0 | 20 | Show HN + `/benchmark` |
| highsignal.app | 0.3 | 20 | Track-record thread + methodology |
| rolepatch.com | 0 | 18 | `/tools` hub + directories |
| aliveville.com | 0 | 15 | Launch post + demo GIF embed |
| significanthobbies.com | 0 | 15 | Niche community shares + IH post |

Products without a dedicated launch will stall at DR 5–8 no matter how polished the site is.

### Six-month execution calendar

Each row = one external-facing moment. Skip a month and EOY 20 across the board becomes unlikely.

| Month | Action | Domains lifted |
|-------|--------|----------------|
| **Jun** | Directories (AlternativeTo, SaaSHub, 2 more per product) · reshares of fleet perf devlog | All (baseline links) |
| **Jul** | CodeVetter Show HN (when unblocked) · benchmark page update | codevetter.com, sassmaker.com |
| **Aug** | High Signal track-record Twitter thread · RolePatch tools SEO push | highsignal.app, rolepatch.com |
| **Sep** | psi-swarm OSS push (README + HN Ask/showcase) · second devlog on sarthakagrawal.dev | sarthakagrawal.dev, sassmaker.com |
| **Oct** | Aliveville launch (Reddit r/gamedev or r/LocalLLaMA) · Significant Hobbies IH post | aliveville.com, significanthobbies.com |
| **Nov** | Fleet year-in-review on sassmaker.com (linkable `/fleet-2026` page) · cross-link all seven | All hubs |
| **Dec** | Product Hunt or second Show HN (best performer YTD) · recap thread with DR screenshot | Flagship product |

### Minimum links per domain (rough)

DR 20 typically implies **50–150+ referring domains** depending on link quality (not volume alone). Per domain by EOY:

- **3–5 directory listings** (DR 40–70 sites)
- **1 launch moment** that earns 5–20 organic links (HN, Reddit, dev Twitter)
- **1 embeddable asset** others cite (benchmark, tools page, methodology doc)
- **Hub cross-links** (sassmaker + sarthakagrawal.dev) — weak alone, compounds with the above

### Weekly check (psi-swarm)

1. Run `psi-swarm serve` — watch DR column on `/projects`
2. Ahrefs free API / Site Explorer — **referring domains count** per custom domain
3. Log launches in this file (`Status:` lines) so the next pass knows what's done

### If behind in October

Prioritize **hubs first** (sassmaker.com + sarthakagrawal.dev to DR 20), then the two products with the most traction (likely CodeVetter + High Signal). Re-scope laggards to DR 12–15 rather than spreading launches thin across all seven.

