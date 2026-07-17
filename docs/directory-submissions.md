# Fleet directory submissions

**Contact:** `sarthakagrawal@agentmail.to` (AgentMail)  
**Products:** 23 public surfaces in `config/directory-submissions/products.json`  
**Logs:** `config/directory-submissions/log.jsonl` · `status.json` · `research-probe.json`  
**Tools:** `scripts/directory-submit/spray.py`

**Outcomes:** Free-directory spray is awareness-only. For AI citations + Domain
Rating, follow [`geo-dr-outcomes.md`](./geo-dr-outcomes.md) — deploy S-tier
agent surfaces (`agent-ready`) and human-kick high-DA listings only.

## Research pass (2026-07-17)

Sources scanned:

- [rushout09/directory-submission-sites](https://github.com/rushout09/directory-submission-sites) (250+ free DA list)
- [best-of-ai/ai-directories](https://github.com/best-of-ai/ai-directories)
- Smol Launch / startupproject / GrowPad free SaaS directory writeups

**113 submit URLs probed** with Playwright for CAPTCHA / Cloudflare / auth / multi-field free forms.  
**17 looked automatable** on first pass; most of the rest are CAPTCHA, OAuth, paid, dead, or login-only.

## Parallel runner

```bash
cd fleet-ops
# 8 processes = 8 Chromiums, one directory per worker
.venv-directory-submit/bin/python scripts/directory-submit/spray_parallel.py --workers 8
# optional: --dirs thestartupinc,dynamite  --force
```

Skips directories already at 23/23. Append-only log uses `fcntl` so workers don't corrupt `log.jsonl`.

## Confirmed full-set sprays (23/23)

| Directory | Evidence | Notes |
|---|---|---|
| **Insidr.ai** | Elementor success toast | Editorial review |
| **Paggu** | `unapproved=` / `#comment-` | Moderation queue |
| **TheStartupInc** | CF7 form + “we will review” | Parallel worker |

Every product in `products.json` on those three.

## Filled / attempted (no success toast)

| Directory | Count | Notes |
|---|---|---|
| Betabound | 23× filled | Free beta announce form (Centercode ticket) |
| Dynamite AI | 23× filled (7 fields) | No toast; may need backlink/badge |
| Toolfinder | 23× filled | **$29 paywall** — not free complete |
| SubmissionWebDirectory | 13× filled | Classic web directory; often needs account |

## Walls (not automatable without you)

CAPTCHA / Cloudflare: Future Tools, Futurepedia, Toolify, Startup Stash, ExactSeek, Peerlist, Product Hunt, SourceForge, Clutch, Open Launch, …

Auth-only: GetWorm, SaaSHub, DevHunt, Startup Fast, Indie Hackers, AlternativeTo, HN, G2 vendor, …

Paid packages: TAAFT launch, Easy With AI ($125), Toolfinder ($29), Dang free needs **backlink to dang.ai**

## Human kick (highest value)

Do these logged-in as you, one product at a time:

1. Product Hunt  
2. Smol Launch  
3. Launching Next  
4. DevHunt  
5. SaaSHub  
6. There's An AI For That  
7. Indie Hackers  
8. AlternativeTo  
9. G2 / Capterra  
10. Show HN (one strong post — not 23 spam)

Copy for paste lives in `products.json` (`name`, `tagline`, `description`, `url`).

## Re-run

```bash
cd fleet-ops
.venv-directory-submit/bin/python scripts/directory-submit/spray.py
# research probe already at config/directory-submissions/research-probe.json
```

## Reality

Quality directories in 2026 gate free bots with CAPTCHA/OAuth. **Spray-and-pray only fully clears open free forms.** Confirmed complete automation: **Insidr + Paggu (46 product-listings)**. Everything else is human or paid or filled-without-ack.
