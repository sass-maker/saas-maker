# Feature: DR Advisor — explain & improve

> **Archived.** This was the original feature proposal. The shipped design
> and its rationale are recorded in
> [`../architecture/decisions/0003-dr-advisor-server-side-gateway.md`](../architecture/decisions/0003-dr-advisor-server-side-gateway.md).
> Kept for history; do not edit here.

**What:** Take a user's list of sites and, next to the historic DR they already
see, explain **why** each site has its score and **how to raise it**.

**Status:** shipped 2026-07-13 · browser-local cache + Cloudflare Pages Function

---

## What already exists (don't rebuild)
- Add sites, stored in localStorage; per-site **historic DR**, sparklines,
  weekly trends, gainers/losers; JSON export. (`app/page.tsx`)
- Server route that fetches DR from Ahrefs' free public API. (`functions/api/dr.ts`)

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
- **Keep the key server-side.** `functions/api/advisor.ts` calls free-ai from
  Cloudflare Pages using `FREE_AI_BASE_URL` plus
  `FREE_AI_GATEWAY_API_KEY` (or `GATEWAY_API_KEY`). The credential never
  enters the client bundle.
- **Cache** advice per (site, DR bucket) so revisits don't re-spend tokens —
  localStorage on the client, optional edge cache on the route.

## Acceptance criteria
- [x] Add/paste a list of sites → each shows historic DR (existing) + an
      "Explain" action.
- [x] "Explain" returns: a concise **why**, explicit evidence limits, and 3–5 prioritized
      **improve** steps.
- [x] Advice is grounded in the site's real DR + trend and clearly labels that
      backlink/site evidence was not inspected.
- [x] The AI call is server-side; no gateway key in the client bundle.
- [x] Graceful degradation: if free-ai is unreachable, still show DR + a quiet
      "couldn't generate advice" note (drank must keep working offline-first).

## Decisions

- Stay on the free DR-only signal; do not imply site inspection.
- Cap output at 900 tokens and require a strict structured response.
- Cache the last 40 successful measurement-bucket responses in localStorage.
- Generation is explicit; opening history never invokes AI.

## Out of scope (v1)
Paid Ahrefs metrics, backlink-level data, automated fixes/outreach.
