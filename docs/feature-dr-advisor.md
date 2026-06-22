# Feature: DR Advisor — explain & improve

**What:** Take a user's list of sites and, next to the historic DR they already
see, explain **why** each site has its score and **how to raise it**.

**Status:** proposed · drank · client + Next API route (Vercel)

---

## What already exists (don't rebuild)
- Add sites, stored in localStorage; per-site **historic DR**, sparklines,
  weekly trends, gainers/losers; JSON export. (`app/page.tsx`)
- Server route that fetches DR from Ahrefs' free public API. (`app/api/dr/route.ts`)

So *"takes a list of sites and shows historic DR"* is largely **done** — this
feature adds the **advisor** layer on top.

## What's new
1. **Why this score** — a plain-language read on what drives the site's DR
   (referring domains, backlink quality/quantity, authority, trend direction).
2. **How to improve** — 3–5 concrete, prioritized actions to raise DR.

## Key constraint → design decision
- Ahrefs' **free** endpoint returns only the DR *number*, not the factors.
  So "why / how" must be **generated**, not fetched.
- Generate via the **free-ai gateway** (the fleet inference grid) from: the site
  URL + its current DR + its trend (drank already has the history) + general
  SEO/backlink knowledge. → drank becomes a free-ai consumer (new, but aligns
  with the grid every other app uses).
- **Keep the key server-side.** Add `app/api/advisor/route.ts` alongside the
  existing `dr` route; it calls free-ai server-side using Vercel env
  (`FREE_AI_BASE_URL`, gateway key). Never ship the gateway key to the browser.
- **Cache** advice per (site, DR bucket) so revisits don't re-spend tokens —
  localStorage on the client, optional edge cache on the route.

## Acceptance criteria
- [ ] Add/paste a list of sites → each shows historic DR (existing) + an
      "Explain" action.
- [ ] "Explain" returns: a 2–3 sentence **why**, and 3–5 prioritized
      **improve** steps.
- [ ] Advice is grounded in the site's real DR + trend, not generic boilerplate.
- [ ] The AI call is server-side; no gateway key in the client bundle.
- [ ] Graceful degradation: if free-ai is unreachable, still show DR + a quiet
      "couldn't generate advice" note (drank must keep working offline-first).

## Open questions
- Pure-LLM advice, or enrich with one cheap grounding signal (homepage fetch /
  sitemap / robots presence) so the "why" isn't hand-wavy?
- Per-site token budget — cap + cache strategy.
- Free Ahrefs API gives DR only; is referring-domains count (paid) worth it for
  a sharper "why", or stay free-tier?

## Out of scope (v1)
Paid Ahrefs metrics, backlink-level data, automated fixes/outreach.
