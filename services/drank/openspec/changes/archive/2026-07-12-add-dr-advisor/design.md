## Context

The current app is a static Next.js export on Cloudflare Pages. Dynamic API
work lives in `functions/api/*.ts`; personal history remains in localStorage.
The free Ahrefs endpoint exposes DR only, so advice must clearly distinguish
observations from general recommendations.

## Decisions

### Keep generation explicit

Opening a domain never calls AI. The client calls `POST /api/advisor` only
after Explain/Regenerate, and sends a normalized domain plus bounded numeric
history summary.

### Validate at both boundaries

The Pages Function validates request bounds, asks the gateway for a JSON object,
and validates the returned explanation, limitations, and action list before
responding. The client validates cached data before displaying it.

### Cache in the browser

Successful responses are stored under a versioned localStorage key using a key
derived from domain, rounded DR bucket, trend direction, and rounded change.
Changing the observed measurement naturally misses the old cache. Cache
failures never block DR tracking.

### Fail closed without hiding DR

Missing gateway configuration returns 503 with recovery copy. Provider,
timeout, and invalid-output failures return a quiet retryable error. Existing
history and dashboard behavior remain available.

## Security and privacy

- Gateway credentials are read only from the Pages Function environment.
- The endpoint rejects invalid domains and out-of-range measurements.
- Prompts prohibit invented site-specific backlink evidence.
- No page content, browser storage, or user identity is sent.
- Responses set no-store; generated advice remains browser-local.

## Verification

- Pure tests cover request/output parsing, cache-key stability, and invalid
  model output.
- Function tests mock the gateway for success, missing config, and provider
  failure.
- Run Vitest, Biome, TypeScript, and the production static build.

