# ADR-0003 — DR Advisor: server-side gateway, structured output, browser cache

**Date:** 2026-07-12 (proposed), 2026-07-13 (shipped)
**Status:** accepted

## Context

Users want to know *why* a site has its DR and *how to raise it*. Ahrefs'
**free** endpoint returns only the DR number — not the factors (referring
domains, backlink quality, etc.). So "why / how" must be **generated**, not
fetched. Generation requires an LLM call; the fleet has a shared inference
gateway (free-ai) for exactly this. The credential must never enter the
client bundle.

## Decision

- Generate via the fleet free-ai gateway from a **bounded** input: the
  normalized domain + current DR + a bounded trend summary. Send nothing
  else (no page content, no user identity, no browser storage).
- Keep the gateway key **server-side**: `functions/api/advisor.ts` reads
  `FREE_AI_GATEWAY_API_KEY` (or `GATEWAY_API_KEY`) and `FREE_AI_BASE_URL`
  from the Pages Function environment. The client never sees the key.
- Require **strict structured output**: `{"schemaVersion":1,"why":string,
  "evidenceLimit":string,"actions":[{priority,title,reason}, ...]}` with
  3–5 prioritized actions. Validate at both boundaries (server parses the
  gateway response; client parses cached advice before display).
- Make generation **explicit**: opening a domain's history never calls AI.
  Only the Explain/Regenerate action triggers `POST /api/advisor`.
- **Cache** successful advice in `localStorage` under
  `drank:advisor:v1`, keyed by a measurement bucket
  (`domain:drBucket:direction:deltaBucket`). A materially different
  measurement naturally misses the old cache.
- **Fail closed without hiding DR**: missing config → 503 with recovery
  copy; provider/timeout/invalid-output → quiet retryable error. Normal DR
  history, refresh, and export always remain available.

## Consequences

- **Positive**: honest, conservative advice that never claims access to
  paid backlink metrics; credentials stay server-side; revisits don't
  re-spend tokens; advisor failure never degrades core tracking.
- **Negative**: advice is general, not site-specific evidence (by design).
  Cache key is coarse (5-point DR bucket) — small DR moves within a bucket
  reuse cached advice until the bucket or trend direction changes.
- **Watch for**: if the gateway prompt or schema changes, bump
  `schemaVersion` and invalidate the cache key scheme.

## Alternatives considered

- **Client-side LLM call with a public key** — rejected: exposes the
  gateway credential.
- **Fetch paid Ahrefs backlink factors** — rejected: out of scope, costs
  money, and would let advice claim real site-specific evidence we don't
  want to pretend to have for free users.
- **No advisor** — rejected: the explain/improve layer is the feature.

## References

- `functions/api/advisor.ts`, `lib/dr-advisor.ts`, `components/DrAdvisor.tsx`
- `functions/api/advisor.test.ts`, `lib/dr-advisor.test.ts`
- OpenSpec: `openspec/specs/dr-advisor/spec.md`
- [Configure DR Advisor gateway runbook](../../operations/runbooks/advisor-gateway.md)
