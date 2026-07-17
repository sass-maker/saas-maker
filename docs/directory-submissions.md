# Fleet directory submissions

Status tracker for listing fleet products on launch directories.

**Contact email:** `sarthakagrawal@agentmail.to` (AgentMail)  
**Payloads:** `config/directory-submissions/products.json`  
**Directory catalog:** `config/directory-submissions/directories.json`  
**Run log:** `config/directory-submissions/log.jsonl`  
**Tooling:** `scripts/directory-submit/` (Playwright venv at `.venv-directory-submit/`)

## What automation can do

Fleet standards: no-CAPTCHA email forms → Playwright + AgentMail; OAuth / CAPTCHA → human.

Most high-value directories in 2026 are **CAPTCHA-walled**, **OAuth-only**, or **paid launch**. Mass “submit everywhere” is not automatable without a paid CAPTCHA solver (out of policy). Quality shortlists beat 100 low-tier dumps.

## Automated results (2026-07-17 spray)

**23 public fleet products** in `products.json` (full spray set). Contact: **sarthakagrawal@agentmail.to**.

| Directory | Products | Result |
|---|---|---|
| **Insidr.ai** | **23/23 confirmed** | Elementor `"Your submission was successful."` |
| Betabound | 23 filled (11 fields each) | Submitted; no success toast (ticket form) — treat as attempt |
| Toolfinder | 23 filled | **Paid** ($29) — not free complete |
| Aitoolnet | partial | Cloudflare |
| Future Tools / Futurepedia / Toolify | attempted | CAPTCHA |
| Dang.ai | magic-link login via AgentMail | Free tier needs **backlink to dang.ai** first |
| TAAFT / PH / SaaSHub / DevHunt / HN / etc. | probed | Auth / CAPTCHA / paywall |

### Insidr.ai — all 23 products confirmed

RolePatch, High Signal, Karte, Significant Hobbies, Materia, PostTrainLLM, Foundry, SaaS Maker Docs, Starboard, CodeVetter, EverythingRated, TrueHire, researchPapers, Pace, AI Gateway, DRank, LoopTV, MAL Explorer, Chess Coach, Reader, Email Manager, SWE Interview Prep, psi-swarm.

Awaiting **their editorial approval** before public listing.

### Spray tooling

```bash
cd fleet-ops
.venv-directory-submit/bin/python scripts/directory-submit/spray.py
# or targeted:
.venv-directory-submit/bin/python scripts/directory-submit/submit_free_forms.py
```

## Human kick (high value)

Do these in a browser logged in as you. Use the same copy from `products.json`.

| # | Directory | Why | URL | Notes |
|---|---|---|---|---|
| 1 | **Product Hunt** | Highest launch reach | producthunt.com/posts/new | OAuth; plan launch day; one product at a time |
| 2 | **Smol Launch** | Weekly indie launch | smollaunch.com | Find current submit path (old `/submit` 404’d) |
| 3 | **Launching Next** | Free permanent dofollow | launchingnext.com | Site “Submit Startup” may be gated; check current form |
| 4 | **DevHunt** | Dev tools dofollow | devhunt.org/submit | Auth account |
| 5 | **SaaSHub** | B2B SaaS | saashub.com/submit | Sign in |
| 6 | **There's An AI For That** | AI traffic | theresanaiforthat.com/launch | Login + often paid packages |
| 7 | **Indie Hackers** | Maker audience | indiehackers.com/products | Account + product + post |
| 8 | **AlternativeTo** | Comparison SEO | alternativeto.net | Account; place vs competitors |
| 9 | **G2 / Capterra** | B2B reviews | g2.com / capterra.com | Vendor portal; slow build |
| 10 | **Hacker News Show HN** | One quality post | news.ycombinator.com/submit | Do **not** spam every product |
| 11 | **BetaList** | Pre-launch only | betalist.com/submit | Only if still beta-ish |
| 12 | **Startup Fast** | Agent CLI exists | startupfa.st | Free needs badge on site; OAuth CLI login |

### Suggested product order for human launches

1. RolePatch  
2. High Signal  
3. Karte  
4. PostTrainLLM  
5. Significant Hobbies / Materia  
6. Foundry (sassmaker.com) as portfolio umbrella  

Skip private tooling (email-manager, reader library). Skip codevetter / protein-index if other agents own those launches.

## Re-run automation

```bash
cd fleet-ops
# optional: recreate venv
# uv venv .venv-directory-submit && uv pip install --python .venv-directory-submit/bin/python playwright
# .venv-directory-submit/bin/playwright install chromium

.venv-directory-submit/bin/python scripts/directory-submit/probe_and_submit.py --mode probe
.venv-directory-submit/bin/python scripts/directory-submit/submit_free_forms.py
```

## Policy notes

- Do not pay for directory spots without explicit approval.
- Do not solve CAPTCHA with third-party solvers unless approved.
- Prefer 3–5 quality listings over 50 nofollow dumps.
- Keep `log.jsonl` as the append-only attempt history.
