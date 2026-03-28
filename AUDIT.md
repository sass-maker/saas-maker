# Security & Quality Audit

Conducted: 2026-03-29

---

## HIGH Severity

- [ ] **No global error handler** — `workers/api/src/index.ts:81` — No `app.onError()` handler. Unhandled exceptions return stack traces to clients, leaking internals.
- [ ] **POST /v1/directory — no spam protection** — `workers/api/src/routes/directory.ts:23` — Unauthenticated write endpoint with no rate limit or honeypot. Bots can flood the directory.
- [ ] **POST /v1/forms/public/:slug/submit — no rate limit** — `workers/api/src/routes/forms.ts:125` — Unauthenticated form submission with no per-IP rate limiting.
- [ ] **POST /v1/testimonials/by-project/:slug — no rate limit** — `workers/api/src/routes/testimonials.ts:41` — Unauthenticated testimonial submission with no per-IP rate limiting.
- [ ] **POST /v1/roadmap/public/:slug/:id/vote — no rate limit, weak validation** — `workers/api/src/routes/roadmap.ts:23` — Unauthenticated vote endpoint. `user_identifier` accepts whitespace-only strings (`.trim()` check exists but no empty-after-trim validation on vote path). No per-IP rate limiting.

## MEDIUM Severity

- [ ] **12MB CockroachDB binary tracked in git** — `workers/api/cockroach-sql-v22.1.9.darwin-10.9-amd64/cockroach-sql` — 12MB binary bloating repo. Should be deleted and added to `.gitignore`.
- [ ] **FeedbackStatus type too narrow** — `packages/shared-types/src/index.ts:3` — `FeedbackStatus = 'new' | 'dismissed' | 'on_roadmap'` but DB and routes use up to 8 values (`new`, `acknowledged`, `investigating`, `planned`, `in_progress`, `resolved`, `dismissed`, `on_roadmap`). `isValidStatus()` in `workers/api/src/routes/feedback.ts:28` only validates 3 values.
- [ ] **Session ID not unique per IP** — `workers/api/src/ua.ts:45` — `computeSessionId()` hashes `date|country|device|browser`. Two users from the same country on the same browser/device/day get the same session ID, inflating unique-visitor counts. Needs IP hash in fingerprint.

## LOW Severity (additional audit findings)

- [ ] **CORS reflects any Origin** — `workers/api/src/index.ts:29` — `origin: origin || '*'` reflects whatever Origin the client sends, combined with `credentials: true`. This allows credentialed requests from any origin. Should allowlist production domains.
- [ ] **Vector search loads all chunks into memory** — `workers/api/src/db.ts:388` — `searchChunks()` fetches ALL embeddings for an index into memory, then computes cosine similarity in JS. Large indexes will OOM the Worker (128MB limit). Acceptable for now with small datasets but a scaling risk.
- [ ] **Rate limit state is per-isolate** — `workers/api/src/middleware/rate-limit.ts:5` — In-memory `Map` resets on every isolate recycle. Distributed rate limiting (e.g., via D1 or KV) would be more robust, but acceptable for current scale.
- [ ] **No secrets in git** — Verified: no `.env`, credential, or key files are tracked. `.gitignore` covers `.env`, `.env.local`, `.dev.vars`.
