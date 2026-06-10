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
> macOS download: https://codevetter.com/download · GitHub: https://github.com/sarthak-fleet/CodeVetter

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
