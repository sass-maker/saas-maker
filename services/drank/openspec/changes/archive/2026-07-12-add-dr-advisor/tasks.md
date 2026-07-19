## 1. Contracts and server boundary

- [x] 1.1 Add bounded advisor request/output contracts, structured parsing, and deterministic cache keys.
- [x] 1.2 Add the Cloudflare Pages Function with server-only gateway credentials, timeout handling, no-store responses, and conservative prompting.
- [x] 1.3 Add focused contract and function tests for success, missing configuration, provider failure, and invalid JSON.

## 2. Browser-local experience

- [x] 2.1 Add a reusable Advisor panel with idle, loading, cached, success, and retryable error states.
- [x] 2.2 Integrate Explain/Regenerate into domain detail without automatic generation.
- [x] 2.3 Cache validated advice locally and keep DR history usable when storage or generation fails.

## 3. Verification and closure

- [x] 3.1 Run focused tests, full tests, typecheck, lint, and production build.
- [x] 3.2 Update the obsolete feature document and PROJECT_STATUS with the current Cloudflare architecture and explicit evidence limits.
- [x] 3.3 Validate, sync, and archive the OpenSpec change; commit and push without deploying or configuring secrets.
