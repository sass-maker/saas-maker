# Waitlist + Analytics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add waitlist and analytics services to saas-maker — same patterns as existing feedback/vector memory services.

**Architecture:** Both services are Hono sub-apps mounted in the existing Cloudflare Worker. Waitlist is a simple CRUD. Analytics has an ingestion endpoint (called by a ~4kb tracking script), dashboard query endpoints, and an SDK package.

**Tech Stack:** Hono, CockroachDB (postgres.js), TypeScript, tsup (SDK build), Vitest

---

### Task 1: Migration + Shared Types

**Files:**
- Create: `packages/db/migrations/0004_waitlist_analytics.sql`
- Modify: `packages/shared-types/src/index.ts`
- Modify: `packages/db/src/schema.ts`

**Step 1: Create migration file**

```sql
-- Waitlist
CREATE TABLE IF NOT EXISTS waitlist_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  position INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, email)
);
CREATE INDEX IF NOT EXISTS idx_waitlist_project ON waitlist_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_position ON waitlist_entries(project_id, position);

-- Analytics
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'page_view',
  url TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  country TEXT,
  device TEXT,
  browser TEXT,
  screen_width INT,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id);
CREATE INDEX IF NOT EXISTS idx_events_project_created ON events(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_project_name ON events(project_id, name);
```

**Step 2: Add shared types**

Add to the `// --- Vector Memory Service ---` section in `packages/shared-types/src/index.ts` (after the existing vector types):

```typescript
// --- Waitlist Service ---

export interface WaitlistEntryRecord {
  id: string;
  project_id: string;
  email: string;
  name: string | null;
  position: number;
  created_at: string;
}

export interface WaitlistSignupRequest {
  email: string;
  name?: string;
}

// --- Analytics Service ---

export interface EventRecord {
  id: string;
  project_id: string;
  name: string;
  url: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  country: string | null;
  device: string | null;
  browser: string | null;
  screen_width: number | null;
  properties: Record<string, unknown>;
  created_at: string;
}

export interface TrackEventRequest {
  name?: string;
  url?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  screen_width?: number;
  properties?: Record<string, unknown>;
}

export interface AnalyticsOverview {
  page_views: number;
  unique_visitors: number;
  top_page: string | null;
  top_referrer: string | null;
}
```

**Step 3: Update schema.ts**

Add `waitlist_entries` and `events` to the `TABLES` const in `packages/db/src/schema.ts`.

**Step 4: Commit**

```bash
git add packages/db/migrations/0004_waitlist_analytics.sql packages/shared-types/src/index.ts packages/db/src/schema.ts
git commit -m "feat: add waitlist + analytics migration and shared types"
```

---

### Task 2: DB Interface + Implementation — Waitlist

**Files:**
- Modify: `packages/db/src/index.ts` (interface)
- Modify: `workers/api/src/db.ts` (implementation)

**Step 1: Add waitlist methods to FeedbackDatabase interface**

Add after the Vector Memory section in `packages/db/src/index.ts`:

```typescript
  // Waitlist
  createWaitlistEntry(input: { id: string; project_id: string; email: string; name: string | null }): Promise<WaitlistEntryRecord>;
  getWaitlistCount(projectId: string): Promise<number>;
  listWaitlistEntries(projectId: string, page: number, limit: number): Promise<{ data: WaitlistEntryRecord[]; total: number }>;
  deleteWaitlistEntry(id: string): Promise<boolean>;
```

Import `WaitlistEntryRecord` at the top.

**Step 2: Implement in db.ts**

Add after the chunks section in `workers/api/src/db.ts`:

```typescript
    // --- Waitlist ---
    async createWaitlistEntry(input) {
      const [posRow] = await sql`
        SELECT COALESCE(MAX(position), 0) + 1 AS next_pos
        FROM waitlist_entries WHERE project_id = ${input.project_id}
      `;
      const [row] = await sql`
        INSERT INTO waitlist_entries (id, project_id, email, name, position)
        VALUES (${input.id}, ${input.project_id}, ${input.email}, ${input.name}, ${posRow.next_pos})
        RETURNING *
      `;
      return row as WaitlistEntryRecord;
    },

    async getWaitlistCount(projectId) {
      const [row] = await sql`
        SELECT COUNT(*)::int AS total FROM waitlist_entries WHERE project_id = ${projectId}
      `;
      return row.total;
    },

    async listWaitlistEntries(projectId, page, limit) {
      const offset = (page - 1) * limit;
      const [countResult] = await sql`
        SELECT COUNT(*)::int AS total FROM waitlist_entries WHERE project_id = ${projectId}
      `;
      const rows = await sql`
        SELECT * FROM waitlist_entries WHERE project_id = ${projectId}
        ORDER BY position ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return { data: rows as unknown as WaitlistEntryRecord[], total: countResult.total };
    },

    async deleteWaitlistEntry(id) {
      const result = await sql`DELETE FROM waitlist_entries WHERE id = ${id}`;
      return result.count > 0;
    },
```

Import `WaitlistEntryRecord` at the top.

**Step 3: Commit**

```bash
git add packages/db/src/index.ts workers/api/src/db.ts
git commit -m "feat: add waitlist DB interface and implementation"
```

---

### Task 3: DB Interface + Implementation — Analytics

**Files:**
- Modify: `packages/db/src/index.ts` (interface)
- Modify: `workers/api/src/db.ts` (implementation)

**Step 1: Add analytics methods to FeedbackDatabase interface**

Add after the Waitlist section:

```typescript
  // Analytics
  createEvent(input: {
    id: string; project_id: string; name: string; url: string | null;
    referrer: string | null; utm_source: string | null; utm_medium: string | null;
    utm_campaign: string | null; country: string | null; device: string | null;
    browser: string | null; screen_width: number | null; properties: Record<string, unknown>;
  }): Promise<EventRecord>;
  getAnalyticsOverview(projectId: string, since: Date): Promise<AnalyticsOverview>;
  getTopPages(projectId: string, since: Date, limit: number): Promise<{ url: string; views: number }[]>;
  getTopReferrers(projectId: string, since: Date, limit: number): Promise<{ referrer: string; count: number }[]>;
  getCountryBreakdown(projectId: string, since: Date, limit: number): Promise<{ country: string; count: number }[]>;
  getDeviceBreakdown(projectId: string, since: Date): Promise<{ device: string; count: number }[]>;
  getCustomEventCounts(projectId: string, since: Date, limit: number): Promise<{ name: string; count: number }[]>;
```

Import `EventRecord` and `AnalyticsOverview` at the top.

**Step 2: Implement in db.ts**

```typescript
    // --- Analytics ---
    async createEvent(input) {
      const [row] = await sql`
        INSERT INTO events (id, project_id, name, url, referrer, utm_source, utm_medium, utm_campaign, country, device, browser, screen_width, properties)
        VALUES (${input.id}, ${input.project_id}, ${input.name}, ${input.url}, ${input.referrer}, ${input.utm_source}, ${input.utm_medium}, ${input.utm_campaign}, ${input.country}, ${input.device}, ${input.browser}, ${input.screen_width}, ${JSON.stringify(input.properties)})
        RETURNING *
      `;
      return row as EventRecord;
    },

    async getAnalyticsOverview(projectId, since) {
      const [row] = await sql`
        SELECT
          COUNT(*)::int AS page_views,
          COUNT(DISTINCT (created_at::date || '|' || COALESCE(country,'') || '|' || COALESCE(device,'') || '|' || COALESCE(browser,'')))::int AS unique_visitors
        FROM events
        WHERE project_id = ${projectId} AND name = 'page_view' AND created_at >= ${since}
      `;
      const [topPage] = await sql`
        SELECT url, COUNT(*)::int AS cnt FROM events
        WHERE project_id = ${projectId} AND name = 'page_view' AND created_at >= ${since} AND url IS NOT NULL
        GROUP BY url ORDER BY cnt DESC LIMIT 1
      `;
      const [topRef] = await sql`
        SELECT referrer, COUNT(*)::int AS cnt FROM events
        WHERE project_id = ${projectId} AND name = 'page_view' AND created_at >= ${since} AND referrer IS NOT NULL AND referrer != ''
        GROUP BY referrer ORDER BY cnt DESC LIMIT 1
      `;
      return {
        page_views: row.page_views,
        unique_visitors: row.unique_visitors,
        top_page: topPage?.url || null,
        top_referrer: topRef?.referrer || null,
      };
    },

    async getTopPages(projectId, since, limit) {
      const rows = await sql`
        SELECT url, COUNT(*)::int AS views FROM events
        WHERE project_id = ${projectId} AND name = 'page_view' AND created_at >= ${since} AND url IS NOT NULL
        GROUP BY url ORDER BY views DESC LIMIT ${limit}
      `;
      return rows as unknown as { url: string; views: number }[];
    },

    async getTopReferrers(projectId, since, limit) {
      const rows = await sql`
        SELECT referrer, COUNT(*)::int AS count FROM events
        WHERE project_id = ${projectId} AND name = 'page_view' AND created_at >= ${since} AND referrer IS NOT NULL AND referrer != ''
        GROUP BY referrer ORDER BY count DESC LIMIT ${limit}
      `;
      return rows as unknown as { referrer: string; count: number }[];
    },

    async getCountryBreakdown(projectId, since, limit) {
      const rows = await sql`
        SELECT country, COUNT(*)::int AS count FROM events
        WHERE project_id = ${projectId} AND created_at >= ${since} AND country IS NOT NULL
        GROUP BY country ORDER BY count DESC LIMIT ${limit}
      `;
      return rows as unknown as { country: string; count: number }[];
    },

    async getDeviceBreakdown(projectId, since) {
      const rows = await sql`
        SELECT device, COUNT(*)::int AS count FROM events
        WHERE project_id = ${projectId} AND created_at >= ${since} AND device IS NOT NULL
        GROUP BY device ORDER BY count DESC
      `;
      return rows as unknown as { device: string; count: number }[];
    },

    async getCustomEventCounts(projectId, since, limit) {
      const rows = await sql`
        SELECT name, COUNT(*)::int AS count FROM events
        WHERE project_id = ${projectId} AND created_at >= ${since} AND name != 'page_view'
        GROUP BY name ORDER BY count DESC LIMIT ${limit}
      `;
      return rows as unknown as { name: string; count: number }[];
    },
```

Import `EventRecord` at the top of db.ts.

**Step 3: Commit**

```bash
git add packages/db/src/index.ts workers/api/src/db.ts
git commit -m "feat: add analytics DB interface and implementation"
```

---

### Task 4: Waitlist Routes

**Files:**
- Create: `workers/api/src/routes/waitlist.ts`
- Modify: `workers/api/src/index.ts` (mount routes)

**Step 1: Create waitlist.ts**

```typescript
import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey } from '../middleware/auth';
import { requireSession } from '../middleware/auth';
import { getDb } from '../db';
import type { WaitlistSignupRequest } from '@saas-maker/shared-types';

const waitlist = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const PAGE_SIZE = 50;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public: signup (API key)
waitlist.post('/', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const body = (await c.req.json()) as WaitlistSignupRequest;

  if (!body.email?.trim()) return c.json({ error: 'Email is required' }, 400);
  if (!EMAIL_RE.test(body.email.trim())) return c.json({ error: 'Invalid email format' }, 400);

  const db = getDb(c.env.DATABASE_URL);

  try {
    const entry = await db.createWaitlistEntry({
      id: crypto.randomUUID(),
      project_id: projectId,
      email: body.email.trim().toLowerCase(),
      name: body.name?.trim() || null,
    });
    return c.json({ id: entry.id, email: entry.email, name: entry.name, position: entry.position, created_at: entry.created_at }, 201);
  } catch (e: any) {
    if (e.message?.includes('duplicate') || e.code === '23505') {
      return c.json({ error: 'Email already on the waitlist' }, 409);
    }
    throw e;
  }
});

// Public: count (API key)
waitlist.get('/count', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const db = getDb(c.env.DATABASE_URL);
  const count = await db.getWaitlistCount(projectId);
  return c.json({ count });
});

// Dashboard: list entries (session auth)
waitlist.get('/', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id query param is required' }, 400);

  const page = parseInt(c.req.query('page') || '1', 10);
  const db = getDb(c.env.DATABASE_URL);

  // Verify ownership
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const result = await db.listWaitlistEntries(projectId, page, PAGE_SIZE);
  return c.json({ data: result.data, total: result.total, page, limit: PAGE_SIZE });
});

// Dashboard: delete entry (session auth)
waitlist.delete('/:id', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const entryId = c.req.param('id');
  const db = getDb(c.env.DATABASE_URL);

  // We need project ownership check — get entry first, then project
  // For simplicity, require project_id as query param
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id query param is required' }, 400);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const deleted = await db.deleteWaitlistEntry(entryId);
  if (!deleted) return c.json({ error: 'Entry not found' }, 404);
  return c.json({ ok: true });
});

export { waitlist };
```

**Step 2: Mount in index.ts**

Add import: `import { waitlist } from './routes/waitlist';`
Add route: `app.route('/v1/waitlist', waitlist);`

**Step 3: Commit**

```bash
git add workers/api/src/routes/waitlist.ts workers/api/src/index.ts
git commit -m "feat: add waitlist API routes"
```

---

### Task 5: Waitlist Auth Tests

**Files:**
- Create: `tests/api/waitlist.test.ts`

**Step 1: Write tests**

```typescript
import { describe, it, expect } from 'vitest';
import { request } from './helpers';

describe('Waitlist routes require auth', () => {
  it('POST /v1/waitlist without X-Project-Key returns 401', async () => {
    const res = await request('/v1/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });

  it('GET /v1/waitlist/count without X-Project-Key returns 401', async () => {
    const res = await request('/v1/waitlist/count');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });

  it('GET /v1/waitlist without Bearer token returns 401', async () => {
    const res = await request('/v1/waitlist');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('DELETE /v1/waitlist/123 without Bearer token returns 401', async () => {
    const res = await request('/v1/waitlist/123', { method: 'DELETE' });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });
});
```

**Step 2: Run tests**

```bash
pnpm run test
```

Expected: All waitlist auth tests pass. All existing tests pass.

**Step 3: Commit**

```bash
git add tests/api/waitlist.test.ts
git commit -m "test: add waitlist auth guard tests"
```

---

### Task 6: Analytics UA Parser + Routes (Ingestion)

**Files:**
- Create: `workers/api/src/ua.ts` (User-Agent parser)
- Create: `workers/api/src/routes/analytics.ts`
- Modify: `workers/api/src/index.ts` (mount routes)

**Step 1: Create UA parser**

Lightweight — no external dependencies. Extract browser family + device type.

```typescript
// workers/api/src/ua.ts

export function parseDevice(ua: string): string {
  if (/mobile|android|iphone|ipod/i.test(ua)) return 'mobile';
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  return 'desktop';
}

export function parseBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\//i.test(ua) || /opera/i.test(ua)) return 'Opera';
  if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) return 'Chrome';
  if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) return 'Safari';
  if (/firefox\//i.test(ua)) return 'Firefox';
  return 'Other';
}
```

**Step 2: Create analytics.ts**

```typescript
import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey, requireSession } from '../middleware/auth';
import { getDb } from '../db';
import { parseDevice, parseBrowser } from '../ua';
import type { TrackEventRequest } from '@saas-maker/shared-types';

const analytics = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const DEFAULT_LIMIT = 10;

function parsePeriod(period?: string): Date {
  const now = new Date();
  switch (period) {
    case '7d': return new Date(now.getTime() - 7 * 86400000);
    case '90d': return new Date(now.getTime() - 90 * 86400000);
    default: return new Date(now.getTime() - 30 * 86400000); // 30d default
  }
}

// --- Ingestion (API key auth) ---

analytics.post('/events', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const body = (await c.req.json()) as TrackEventRequest;

  const ua = c.req.header('User-Agent') || '';
  const country = c.req.header('CF-IPCountry') || null;

  const db = getDb(c.env.DATABASE_URL);
  await db.createEvent({
    id: crypto.randomUUID(),
    project_id: projectId,
    name: body.name || 'page_view',
    url: body.url || null,
    referrer: body.referrer || null,
    utm_source: body.utm_source || null,
    utm_medium: body.utm_medium || null,
    utm_campaign: body.utm_campaign || null,
    country,
    device: parseDevice(ua),
    browser: parseBrowser(ua),
    screen_width: body.screen_width || null,
    properties: body.properties || {},
  });

  return c.json({ ok: true }, 201);
});

// --- Dashboard (session auth) ---

analytics.get('/overview', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const db = getDb(c.env.DATABASE_URL);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const since = parsePeriod(c.req.query('period') || undefined);
  const overview = await db.getAnalyticsOverview(projectId, since);
  return c.json(overview);
});

analytics.get('/pages', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const db = getDb(c.env.DATABASE_URL);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const since = parsePeriod(c.req.query('period') || undefined);
  const data = await db.getTopPages(projectId, since, DEFAULT_LIMIT);
  return c.json({ data });
});

analytics.get('/referrers', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const db = getDb(c.env.DATABASE_URL);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const since = parsePeriod(c.req.query('period') || undefined);
  const data = await db.getTopReferrers(projectId, since, DEFAULT_LIMIT);
  return c.json({ data });
});

analytics.get('/countries', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const db = getDb(c.env.DATABASE_URL);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const since = parsePeriod(c.req.query('period') || undefined);
  const data = await db.getCountryBreakdown(projectId, since, DEFAULT_LIMIT);
  return c.json({ data });
});

analytics.get('/devices', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const db = getDb(c.env.DATABASE_URL);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const since = parsePeriod(c.req.query('period') || undefined);
  const data = await db.getDeviceBreakdown(projectId, since);
  return c.json({ data });
});

analytics.get('/events', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const db = getDb(c.env.DATABASE_URL);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const since = parsePeriod(c.req.query('period') || undefined);
  const data = await db.getCustomEventCounts(projectId, since, DEFAULT_LIMIT);
  return c.json({ data });
});

export { analytics };
```

**Step 3: Mount in index.ts**

Add import: `import { analytics } from './routes/analytics';`
Add route: `app.route('/v1/analytics', analytics);`

**Step 4: Commit**

```bash
git add workers/api/src/ua.ts workers/api/src/routes/analytics.ts workers/api/src/index.ts
git commit -m "feat: add analytics routes with UA parser"
```

---

### Task 7: Analytics + UA Parser Tests

**Files:**
- Create: `tests/api/analytics.test.ts`
- Create: `tests/api/ua.test.ts`

**Step 1: Write UA parser tests**

```typescript
// tests/api/ua.test.ts
import { describe, it, expect } from 'vitest';
import { parseDevice, parseBrowser } from '../../workers/api/src/ua';

describe('parseDevice', () => {
  it('detects mobile', () => {
    expect(parseDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)')).toBe('mobile');
    expect(parseDevice('Mozilla/5.0 (Linux; Android 13)')).toBe('mobile');
  });

  it('detects tablet', () => {
    expect(parseDevice('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)')).toBe('tablet');
  });

  it('defaults to desktop', () => {
    expect(parseDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('desktop');
    expect(parseDevice('')).toBe('desktop');
  });
});

describe('parseBrowser', () => {
  it('detects Chrome', () => {
    expect(parseBrowser('Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36')).toBe('Chrome');
  });

  it('detects Safari', () => {
    expect(parseBrowser('Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Safari/605.1.15')).toBe('Safari');
  });

  it('detects Firefox', () => {
    expect(parseBrowser('Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0')).toBe('Firefox');
  });

  it('detects Edge over Chrome', () => {
    expect(parseBrowser('Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36 Edg/120.0')).toBe('Edge');
  });

  it('returns Other for unknown', () => {
    expect(parseBrowser('curl/7.88.1')).toBe('Other');
  });
});
```

**Step 2: Write analytics auth tests**

```typescript
// tests/api/analytics.test.ts
import { describe, it, expect } from 'vitest';
import { request } from './helpers';

describe('Analytics ingestion requires API key', () => {
  it('POST /v1/analytics/events without X-Project-Key returns 401', async () => {
    const res = await request('/v1/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });
});

describe('Analytics dashboard requires session', () => {
  it('GET /v1/analytics/overview without Bearer returns 401', async () => {
    const res = await request('/v1/analytics/overview');
    expect(res.status).toBe(401);
  });

  it('GET /v1/analytics/pages without Bearer returns 401', async () => {
    const res = await request('/v1/analytics/pages');
    expect(res.status).toBe(401);
  });

  it('GET /v1/analytics/referrers without Bearer returns 401', async () => {
    const res = await request('/v1/analytics/referrers');
    expect(res.status).toBe(401);
  });

  it('GET /v1/analytics/countries without Bearer returns 401', async () => {
    const res = await request('/v1/analytics/countries');
    expect(res.status).toBe(401);
  });

  it('GET /v1/analytics/devices without Bearer returns 401', async () => {
    const res = await request('/v1/analytics/devices');
    expect(res.status).toBe(401);
  });

  it('GET /v1/analytics/events without Bearer returns 401', async () => {
    const res = await request('/v1/analytics/events');
    expect(res.status).toBe(401);
  });
});
```

**Step 3: Run tests**

```bash
pnpm run test
```

Expected: All tests pass.

**Step 4: Commit**

```bash
git add tests/api/ua.test.ts tests/api/analytics.test.ts
git commit -m "test: add UA parser and analytics auth tests"
```

---

### Task 8: Analytics SDK Package

**Files:**
- Create: `packages/analytics-sdk/package.json`
- Create: `packages/analytics-sdk/tsconfig.json`
- Create: `packages/analytics-sdk/tsup.config.ts`
- Create: `packages/analytics-sdk/src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@saas-maker/analytics-sdk",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsup"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.0.0"
  }
}
```

**Step 2: Create tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['iife'],
  globalName: 'sm',
  minify: true,
  outDir: 'dist',
  dts: false,
  clean: true,
});
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM"],
    "strict": true,
    "outDir": "dist",
    "declaration": true
  },
  "include": ["src"]
}
```

**Step 4: Create src/index.ts**

```typescript
// @saas-maker/analytics-sdk — ~4kb tracking script
// Usage: <script defer src="https://cdn.saasmaker.dev/a.js" data-project="pk_xxx"></script>

(function () {
  const API_PATH = '/v1/analytics/events';

  // Find our script tag and read config
  const scripts = document.querySelectorAll('script[data-project]');
  const scriptEl = scripts[scripts.length - 1] as HTMLScriptElement | undefined;
  if (!scriptEl) return;

  const projectKey = scriptEl.getAttribute('data-project');
  if (!projectKey) return;

  const apiBase = scriptEl.getAttribute('data-api') || 'https://api.saasmaker.dev';

  // Respect Do Not Track
  if (navigator.doNotTrack === '1') return;

  // --- Queue (for calls made before script load) ---
  type QueueItem = [string, Record<string, unknown>?];
  const win = window as any;
  const queue: QueueItem[] = win.sm?.q || [];

  // --- Send event ---
  function send(name: string, props?: Record<string, unknown>) {
    const url = location.href;
    const referrer = document.referrer;
    const params = new URLSearchParams(location.search);

    const payload: Record<string, unknown> = {
      name,
      url,
      referrer: referrer || undefined,
      utm_source: params.get('utm_source') || undefined,
      utm_medium: params.get('utm_medium') || undefined,
      utm_campaign: params.get('utm_campaign') || undefined,
      screen_width: window.innerWidth,
    };

    if (props && Object.keys(props).length > 0) {
      payload.properties = props;
    }

    // Clean undefineds
    for (const key of Object.keys(payload)) {
      if (payload[key] === undefined) delete payload[key];
    }

    const body = JSON.stringify(payload);
    const endpoint = apiBase + API_PATH;
    const headers = {
      'Content-Type': 'application/json',
      'X-Project-Key': projectKey!,
    };

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      // sendBeacon doesn't support custom headers, use fetch instead
      fetch(endpoint, { method: 'POST', headers, body, keepalive: true }).catch(() => {});
    } else {
      fetch(endpoint, { method: 'POST', headers, body }).catch(() => {});
    }
  }

  // --- Public API ---
  function track(name: string, properties?: Record<string, unknown>) {
    send(name, properties);
  }

  // Expose globally
  win.sm = track;
  win.sm.track = track;

  // Flush queue
  for (const [name, props] of queue) {
    track(name, props);
  }

  // --- Auto page view ---
  let lastUrl = '';

  function pageView() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    send('page_view');
  }

  // Initial page view
  pageView();

  // SPA support: patch pushState/replaceState
  const origPush = history.pushState;
  const origReplace = history.replaceState;

  history.pushState = function (...args) {
    origPush.apply(this, args);
    pageView();
  };

  history.replaceState = function (...args) {
    origReplace.apply(this, args);
    pageView();
  };

  window.addEventListener('popstate', pageView);
})();
```

**Step 5: Install dependencies and build**

```bash
pnpm --filter @saas-maker/analytics-sdk install
pnpm --filter @saas-maker/analytics-sdk run build
```

**Step 6: Commit**

```bash
git add packages/analytics-sdk/
git commit -m "feat: add analytics SDK tracking script (~4kb)"
```

---

### Task 9: Run Migration

**Step 1: Run migration against CockroachDB**

Use the same approach as the vector memory migration. Read the DATABASE_URL from wrangler config or .dev.vars, then run:

```bash
PGPASSWORD='<password>' /opt/homebrew/opt/postgresql@17/bin/psql \
  -h <host> -p 26257 -U <user> -d <db> \
  -f packages/db/migrations/0004_waitlist_analytics.sql
```

**Step 2: Verify tables exist**

```bash
PGPASSWORD='<password>' /opt/homebrew/opt/postgresql@17/bin/psql \
  -h <host> -p 26257 -U <user> -d <db> \
  -c "\dt waitlist_entries" -c "\dt events"
```

---

### Task 10: Final Verification

**Step 1: Run full test suite**

```bash
pnpm run test
```

Expected: All tests pass (existing + new waitlist + analytics + UA parser tests).

**Step 2: Verify types build**

```bash
pnpm --filter @saas-maker/shared-types exec tsc --noEmit
```

**Step 3: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: final verification — all tests passing"
```
