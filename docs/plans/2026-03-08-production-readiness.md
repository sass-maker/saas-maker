# Production Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make SaaS Maker production-ready: fix CLI bug, add project-level rate limiting, complete SDK to cover all 76 API endpoints, add project README feature, add streaming support to SDK.

**Architecture:** SDK services mirror API routes 1:1. Rate limiting uses a per-project configurable limit stored in DB, enforced via middleware on API-key-authenticated routes. Project README is a markdown field on the projects table exposed via API + SDK.

**Tech Stack:** TypeScript, Hono middleware, CockroachDB, @saas-maker/sdk

---

### Task 1: Fix CLI status command — remove deleted /v1/links reference

**Files:**
- Modify: `packages/cli/src/commands/status.ts`

**Step 1:** Remove the `/v1/links` request and `Links` feature from the status output.

In `status.ts`, remove `linksRes` from the `Promise.all` array (line 100) and remove the `Links` entry from the `features` array (line 121). Renumber the destructured array.

**Step 2:** Verify CLI typechecks

Run: `cd packages/cli && pnpm tsc --noEmit`
Expected: Clean

**Step 3:** Run tests

Run: `pnpm test`
Expected: All pass

**Step 4:** Commit

```bash
git add packages/cli/src/commands/status.ts
git commit -m "fix: remove deleted /v1/links reference from CLI status command"
```

---

### Task 2: Add project-level configurable rate limiting

**Files:**
- Create: `packages/db/migrations/0014_rate_limits.sql`
- Modify: `workers/api/src/db.ts` — add rate limit DB methods
- Modify: `packages/db/src/index.ts` — add to FeedbackDatabase interface
- Create: `workers/api/src/middleware/rate-limit.ts`
- Modify: `workers/api/src/index.ts` — mount rate limit middleware
- Modify: `workers/api/src/routes/projects.ts` — expose rate limit config in project CRUD
- Modify: `workers/api/src/types.ts` — if needed

**Design:**

Migration adds columns to projects table:
```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS rate_limit_rpm INT NOT NULL DEFAULT 60;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS rate_limit_enabled BOOLEAN NOT NULL DEFAULT true;
```

Rate limit middleware (applied after `requireApiKey`):
- On each API-key-authenticated request, check a sliding window counter
- Use Cloudflare Workers KV or in-memory Map with TTL (prefer simple approach: store `{projectId}:{minuteBucket}` counter in a `rate_limit_hits` table or use Workers' `waitUntil` with in-memory tracking)
- Simple approach: Use a DB table `rate_limit_counters` with `project_id, window_start, count` — increment on each request, reject with 429 if over limit
- Even simpler: Use Cloudflare's built-in rate limiting headers approach — store the limit in DB, track in-memory per isolate (good enough for single-worker)

**Simplest production approach:** Add a lightweight in-memory sliding window per isolate. Workers are ephemeral so this is approximate but effective. Store the configurable limit in the projects table.

Middleware pseudo-code:
```typescript
const counters = new Map<string, { count: number; resetAt: number }>();

export const rateLimit = createMiddleware(async (c, next) => {
  const projectId = c.get('projectId');
  if (!projectId) return next(); // Not an API-key route

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectById(projectId);
  if (!project?.rate_limit_enabled) return next();

  const now = Date.now();
  const windowMs = 60_000;
  const key = projectId;
  const entry = counters.get(key);

  if (!entry || now > entry.resetAt) {
    counters.set(key, { count: 1, resetAt: now + windowMs });
    c.header('X-RateLimit-Limit', String(project.rate_limit_rpm));
    c.header('X-RateLimit-Remaining', String(project.rate_limit_rpm - 1));
    return next();
  }

  entry.count++;
  const remaining = Math.max(0, project.rate_limit_rpm - entry.count);
  c.header('X-RateLimit-Limit', String(project.rate_limit_rpm));
  c.header('X-RateLimit-Remaining', String(remaining));

  if (entry.count > project.rate_limit_rpm) {
    c.header('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  return next();
});
```

Expose `rate_limit_rpm` and `rate_limit_enabled` in project PATCH endpoint so owners can configure it.

**Step 1:** Create migration
**Step 2:** Add DB methods (`getProjectById` already returns project — just ensure new columns are included)
**Step 3:** Create rate-limit middleware
**Step 4:** Mount middleware in `index.ts` after CORS, before routes
**Step 5:** Update projects PATCH to accept `rate_limit_rpm` and `rate_limit_enabled`
**Step 6:** Write tests for rate limiting
**Step 7:** Commit

---

### Task 3: Add project README feature

**Files:**
- Create: `packages/db/migrations/0015_project_readme.sql`
- Modify: `workers/api/src/db.ts` — add readme DB methods
- Modify: `workers/api/src/routes/projects.ts` — add GET/PUT readme endpoints
- Modify: `packages/sdk/src/services/projects.ts` (new file) — SDK project service

**Design:**

Migration:
```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS readme TEXT;
```

New API routes on projects:
```
GET  /v1/projects/:id/readme      (requireSession, ownership check)
PUT  /v1/projects/:id/readme      (requireSession, ownership check, body: { content: string })
```

Also expose `readme` in existing `GET /v1/projects/by-slug/:slug` response.

**Step 1:** Create migration
**Step 2:** Add readme column to DB queries (getProjectById, getProjectBySlug already return `*`)
**Step 3:** Add GET/PUT readme routes
**Step 4:** Write tests
**Step 5:** Commit

---

### Task 4: Complete SDK — Add RoadmapService

**Files:**
- Create: `packages/sdk/src/services/roadmap.ts`
- Modify: `packages/sdk/src/client.ts` — register service
- Modify: `packages/sdk/src/index.ts` — re-export types

**Methods to implement (matching workers/api/src/routes/roadmap.ts):**
- `listPublic(slug)` → GET `/v1/roadmap/public/:slug`
- `vote(slug, itemId, data)` → POST `/v1/roadmap/public/:slug/:id/vote`
- `removeVote(slug, itemId, userIdentifier)` → DELETE `/v1/roadmap/public/:slug/:id/vote`

Note: Dashboard routes (list, create, update, delete, reorder, fromFeedback) require session auth. The SDK uses API key auth via `X-Project-Key`. Dashboard methods should NOT be in the SDK — they're for the dashboard UI only. Only expose public-facing methods.

**Step 1:** Create roadmap service with types
**Step 2:** Register in client.ts, re-export types
**Step 3:** Commit

---

### Task 5: Complete SDK — Add missing Feedback methods

**Files:**
- Modify: `packages/sdk/src/services/feedback.ts`

**Methods to add:**
- `list(options?)` → GET `/v1/feedback` (API key auth — the existing route)
- `listByProject` already exists

Note: upvote/downvote/updateStatus/delete require session auth (Bearer token), not API key. These should NOT be in the SDK. The SDK is API-key-based.

Actually, `list()` using API key auth already works but SDK only has `listByProject(slug)` which uses the public no-auth route. Add `list()` that uses the API-key-authenticated route.

**Step 1:** Add `list(options?)` method
**Step 2:** Commit

---

### Task 6: Complete SDK — Add missing Forms methods

**Files:**
- Modify: `packages/sdk/src/services/forms.ts`

**Methods to add:**
- `getPublic(slug)` → GET `/v1/forms/public/:slug` (no auth)
- `submitPublic(slug, data)` → POST `/v1/forms/public/:slug/submit` (no auth)

Note: `getBySlug` already exists (uses API key). Public routes need no auth but the SDK's HttpClient always sends `X-Project-Key`. The public routes don't require it — they just ignore it. So the existing HttpClient works fine for public routes too.

Dashboard form CRUD methods require session auth → NOT in SDK.

**Step 1:** Add `getPublic()` and `submitPublic()` methods
**Step 2:** Update types (FormQuestion types are out of date — API has 15 types, SDK has 6)
**Step 3:** Commit

---

### Task 7: Complete SDK — Add missing Waitlist method

**Files:**
- Modify: `packages/sdk/src/services/waitlist.ts`

**Methods to add:**
- `getCount()` → GET `/v1/waitlist/count` (API key auth)

**Step 1:** Add method
**Step 2:** Commit

---

### Task 8: Complete SDK — Add AI streaming support

**Files:**
- Modify: `packages/sdk/src/http.ts` — add `requestRaw()` method that returns raw Response
- Modify: `packages/sdk/src/services/ai-gateway.ts` — add `chatStream()` and `ragStream()` methods

**Design:**

Add `requestRaw` to HttpClient:
```typescript
async requestRaw(method: string, path: string, body?: unknown): Promise<Response> {
  const res = await fetch(`${this.baseUrl}${path}`, { ... });
  if (!res.ok) { throw... }
  return res;
}
```

Add streaming methods:
```typescript
chatStream(options: AIChatOptions): Promise<Response> {
  return this.http.requestRaw('POST', '/v1/ai/chat/completions', { ...options, stream: true });
}
ragStream(options: AIRagOptions): Promise<Response> {
  return this.http.requestRaw('POST', '/v1/ai/rag', { ...options, stream: true });
}
```

Users can then do:
```typescript
const response = await client.ai.chatStream({ messages: [...] });
const reader = response.body.getReader();
// Read SSE chunks
```

**Step 1:** Add `requestRaw` to HttpClient
**Step 2:** Add `chatStream` and `ragStream`
**Step 3:** Commit

---

### Task 9: Complete SDK — Add ProjectService with README support

**Files:**
- Create: `packages/sdk/src/services/projects.ts`
- Modify: `packages/sdk/src/client.ts` — register service
- Modify: `packages/sdk/src/index.ts` — re-export types

**Note:** Projects routes use session auth (`requireSession`), but the README endpoints should also work via API key so SDK users can read/write their project README. Add API-key variants of the readme endpoints in the API.

Actually — looking at the API, all project routes use `requireSession`. The SDK uses API key. So we need to add API-key-accessible README routes:

Add to `workers/api/src/routes/projects.ts` or a new route:
```
GET  /v1/projects/readme  (requireApiKey — returns readme for the authenticated project)
PUT  /v1/projects/readme  (requireApiKey — updates readme)
```

**Step 1:** Add API-key readme routes
**Step 2:** Create ProjectService in SDK with `getReadme()` and `updateReadme(content)`
**Step 3:** Commit

---

### Task 10: Fix CORS fallback

**Files:**
- Modify: `workers/api/src/index.ts`

**Step 1:** Change CORS origin handler to not return `'*'` when origin is missing or CORS_ORIGIN is unset. Return `''` (deny) instead when no CORS_ORIGIN is configured, but keep localhost allowed for dev.

```typescript
origin: (origin) => {
  // Allow same-origin requests (no Origin header)
  if (!origin) return '*';
  // Always allow localhost for development
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  // Check against configured origins
  if (allowed.length > 0 && allowed.includes(origin)) return origin;
  // Deny if no match
  return '';
},
```

**Step 2:** Commit

---

### Task 11: Run full test suite, build, and push

**Step 1:** Run `pnpm test` — all tests pass
**Step 2:** Typecheck CLI: `cd packages/cli && pnpm tsc --noEmit`
**Step 3:** Typecheck API: `cd workers/api && pnpm tsc --noEmit`
**Step 4:** Build CLI: `cd packages/cli && pnpm build`
**Step 5:** Build SDK: `cd packages/sdk && pnpm build`
**Step 6:** Push all commits
**Step 7:** Update AGENTS.md if needed
