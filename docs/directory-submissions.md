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

## Automated results (2026-07-17)

| Directory | Products | Result |
|---|---|---|
| **Insidr.ai** | 12 confirmed + RolePatch flaky | **Submitted** — Elementor `"Your submission was successful."` |
| Aitoolnet | partial | Cloudflare after 1–2 posts |
| Future Tools | all attempted | CAPTCHA blocked |
| TAAFT / Toolify / Uneed / Open Launch / Peerlist | probed | CAPTCHA or paywall |
| SaaSHub / DevHunt / Startup Fast / Microlaunch | probed | Auth required |
| Launching Next `/submit` | probed | Newsletter only (no product form) |
| Easy With AI | probed | Paid ($125) |

### Insidr.ai confirmed submissions (awaiting editorial approval)

High Signal, Karte, PostTrainLLM, Starboard, EverythingRated, researchPapers, Pace, AI Gateway, Significant Hobbies, Materia, Foundry (SaaS Maker), psi-swarm.

**RolePatch** filled but did not return a success toast — retry manually if missing from their queue.

Email used where required: **sarthakagrawal@agentmail.to**.

No new verification messages in AgentMail after these free forms (they don’t email-verify on submit).

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
