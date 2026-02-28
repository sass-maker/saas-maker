# Dashboard Redesign + Short URL Service Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the dashboard with sidebar navigation, add waitlist/analytics/short links pages, extract reusable patterns, and build the short URL backend service.

**Architecture:** Backend-first for short URLs (migration, types, DB, routes, tests), then dashboard infrastructure (shared types wiring, API client, reusable components), then sidebar layout rewrite, then individual pages. Each page follows the pattern: PageHeader + StatCards + DataTable.

**Tech Stack:** Next.js 16 App Router, shadcn/ui (new-york), Tailwind 4, Recharts, Hono, CockroachDB, postgres.js

---

### Task 1: Short URL Migration + Schema

**Files:**
- Create: `packages/db/migrations/0005_short_links.sql`
- Modify: `packages/db/src/schema.ts`

**Step 1: Write the migration file**

Create `packages/db/migrations/0005_short_links.sql`:

```sql
-- Short Links service
CREATE TABLE IF NOT EXISTS short_links (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  destination TEXT NOT NULL,
  title       TEXT,
  expires_at  TIMESTAMPTZ,
  click_count INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT short_links_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_short_links_project ON short_links(project_id);
CREATE INDEX IF NOT EXISTS idx_short_links_project_created ON short_links(project_id, created_at DESC);

-- GIN index for filtering events by link_id in properties
CREATE INDEX IF NOT EXISTS idx_events_properties ON events USING GIN (properties);
```

**Step 2: Update schema.ts**

Add `short_links: 'short_links'` to the TABLES object in `packages/db/src/schema.ts`.

**Step 3: Commit**

```bash
git add packages/db/migrations/0005_short_links.sql packages/db/src/schema.ts
git commit -m "feat: add short_links migration and schema"
```

---

### Task 2: Short URL Shared Types

**Files:**
- Modify: `packages/shared-types/src/index.ts`

**Step 1: Add short link types**

Append these types after the Analytics section in `packages/shared-types/src/index.ts`:

```typescript
// --- Short Links Service ---

export interface ShortLinkRecord {
  id: string;
  project_id: string;
  slug: string;
  destination: string;
  title: string | null;
  expires_at: string | null;
  click_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateShortLinkRequest {
  destination: string;
  slug?: string;
  title?: string;
  expires_at?: string;
}

export interface UpdateShortLinkRequest {
  destination?: string;
  title?: string;
  expires_at?: string | null;
}

export interface ShortLinkStats {
  link_id: string;
  slug: string;
  total_clicks: number;
  clicks_by_country: { country: string; count: number }[];
  clicks_by_device: { device: string; count: number }[];
  clicks_by_referrer: { referrer: string; count: number }[];
  clicks_over_time: { date: string; count: number }[];
}
```

**Step 2: Commit**

```bash
git add packages/shared-types/src/index.ts
git commit -m "feat: add short link shared types"
```

---

### Task 3: Short URL Database Interface + Implementation

**Files:**
- Modify: `packages/db/src/index.ts` (interface)
- Modify: `workers/api/src/db.ts` (implementation)

**Step 1: Add 8 methods to FeedbackDatabase interface**

In `packages/db/src/index.ts`, add import for `ShortLinkRecord, ShortLinkStats` from shared-types, then add to the interface:

```typescript
  // Short Links
  createShortLink(input: {
    id: string; project_id: string; slug: string; destination: string;
    title: string | null; expires_at: string | null;
  }): Promise<ShortLinkRecord>;
  getShortLinkBySlug(slug: string): Promise<ShortLinkRecord | null>;
  getShortLinkById(id: string): Promise<ShortLinkRecord | null>;
  listShortLinks(projectId: string, page: number, limit: number): Promise<{ data: ShortLinkRecord[]; total: number }>;
  updateShortLink(id: string, input: { destination?: string; title?: string; expires_at?: string | null }): Promise<ShortLinkRecord | null>;
  deleteShortLink(id: string): Promise<boolean>;
  incrementLinkClickCount(id: string): Promise<void>;
  getShortLinkStats(linkId: string, projectId: string): Promise<ShortLinkStats>;
```

**Step 2: Implement in workers/api/src/db.ts**

Add import for `ShortLinkRecord` to the import line at top. Then add after the analytics methods:

```typescript
    // --- Short Links ---
    async createShortLink(input) {
      const [row] = await sql`
        INSERT INTO short_links (id, project_id, slug, destination, title, expires_at)
        VALUES (${input.id}, ${input.project_id}, ${input.slug}, ${input.destination}, ${input.title}, ${input.expires_at})
        RETURNING *
      `;
      return row as ShortLinkRecord;
    },

    async getShortLinkBySlug(slug) {
      const [row] = await sql`SELECT * FROM short_links WHERE slug = ${slug}`;
      return (row as ShortLinkRecord) || null;
    },

    async getShortLinkById(id) {
      const [row] = await sql`SELECT * FROM short_links WHERE id = ${id}`;
      return (row as ShortLinkRecord) || null;
    },

    async listShortLinks(projectId, page, limit) {
      const offset = (page - 1) * limit;
      const [countResult] = await sql`SELECT COUNT(*)::int AS total FROM short_links WHERE project_id = ${projectId}`;
      const rows = await sql`
        SELECT * FROM short_links WHERE project_id = ${projectId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return { data: rows as unknown as ShortLinkRecord[], total: countResult.total };
    },

    async updateShortLink(id, input) {
      const sets = [];
      if (input.destination !== undefined) sets.push(sql`destination = ${input.destination}`);
      if (input.title !== undefined) sets.push(sql`title = ${input.title}`);
      if (input.expires_at !== undefined) sets.push(sql`expires_at = ${input.expires_at}`);
      sets.push(sql`updated_at = NOW()`);

      const setClause = sets.reduce((acc, s, i) => i === 0 ? s : sql`${acc}, ${s}`);
      const [row] = await sql`UPDATE short_links SET ${setClause} WHERE id = ${id} RETURNING *`;
      return (row as ShortLinkRecord) || null;
    },

    async deleteShortLink(id) {
      const result = await sql`DELETE FROM short_links WHERE id = ${id}`;
      return result.count > 0;
    },

    async incrementLinkClickCount(id) {
      await sql`UPDATE short_links SET click_count = click_count + 1 WHERE id = ${id}`;
    },

    async getShortLinkStats(linkId, projectId) {
      const [total] = await sql`
        SELECT COUNT(*)::int AS total_clicks FROM events
        WHERE project_id = ${projectId} AND name = 'link_click'
          AND properties->>'link_id' = ${linkId}
      `;
      const byCountry = await sql`
        SELECT country, COUNT(*)::int AS count FROM events
        WHERE project_id = ${projectId} AND name = 'link_click'
          AND properties->>'link_id' = ${linkId} AND country IS NOT NULL
        GROUP BY country ORDER BY count DESC LIMIT 10
      `;
      const byDevice = await sql`
        SELECT device, COUNT(*)::int AS count FROM events
        WHERE project_id = ${projectId} AND name = 'link_click'
          AND properties->>'link_id' = ${linkId} AND device IS NOT NULL
        GROUP BY device ORDER BY count DESC
      `;
      const byReferrer = await sql`
        SELECT referrer, COUNT(*)::int AS count FROM events
        WHERE project_id = ${projectId} AND name = 'link_click'
          AND properties->>'link_id' = ${linkId}
          AND referrer IS NOT NULL AND referrer != ''
        GROUP BY referrer ORDER BY count DESC LIMIT 10
      `;
      const overTime = await sql`
        SELECT created_at::date AS date, COUNT(*)::int AS count FROM events
        WHERE project_id = ${projectId} AND name = 'link_click'
          AND properties->>'link_id' = ${linkId}
        GROUP BY date ORDER BY date ASC
      `;
      const link = await sql`SELECT slug FROM short_links WHERE id = ${linkId}`;
      return {
        link_id: linkId,
        slug: link[0]?.slug || '',
        total_clicks: total.total_clicks,
        clicks_by_country: byCountry as unknown as { country: string; count: number }[],
        clicks_by_device: byDevice as unknown as { device: string; count: number }[],
        clicks_by_referrer: byReferrer as unknown as { referrer: string; count: number }[],
        clicks_over_time: overTime as unknown as { date: string; count: number }[],
      };
    },
```

**Step 3: Commit**

```bash
git add packages/db/src/index.ts workers/api/src/db.ts
git commit -m "feat: add short link database interface and implementation"
```

---

### Task 4: Short URL Routes + Tests

**Files:**
- Create: `workers/api/src/routes/links.ts`
- Modify: `workers/api/src/index.ts`
- Create: `tests/api/links.test.ts`

**Step 1: Write the test file**

Create `tests/api/links.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { request } from './helpers';

describe('Short link routes require auth', () => {
  it('POST /v1/links without X-Project-Key returns 401', async () => {
    const res = await request('/v1/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: 'https://example.com' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });

  it('GET /v1/links without X-Project-Key returns 401', async () => {
    const res = await request('/v1/links');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });

  it('GET /v1/links/some-id without X-Project-Key returns 401', async () => {
    const res = await request('/v1/links/some-id');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });

  it('PATCH /v1/links/some-id without X-Project-Key returns 401', async () => {
    const res = await request('/v1/links/some-id', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: 'https://example.com' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });

  it('DELETE /v1/links/some-id without X-Project-Key returns 401', async () => {
    const res = await request('/v1/links/some-id', { method: 'DELETE' });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });

  it('GET /v1/links/dashboard/proj-id without Bearer token returns 401', async () => {
    const res = await request('/v1/links/dashboard/proj-id');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('GET /v1/links/dashboard/proj-id/stats/link-id without Bearer token returns 401', async () => {
    const res = await request('/v1/links/dashboard/proj-id/stats/link-id');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker && pnpm vitest run tests/api/links.test.ts
```

Expected: FAIL — routes don't exist yet.

**Step 3: Create the links routes**

Create `workers/api/src/routes/links.ts`:

```typescript
import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey, requireSession } from '../middleware/auth';
import { getDb } from '../db';
import { parseDevice, parseBrowser } from '../ua';
import type { CreateShortLinkRequest, UpdateShortLinkRequest } from '@saasmaker/shared-types';

const links = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const SLUG_RE = /^[A-Za-z0-9_-]{1,64}$/;
const URL_RE = /^https?:\/\/.+/;
const PAGE_SIZE = 20;

function generateSlug(len = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes).map(b => BASE62[b % 62]).join('');
}

// --- Public redirect (registered separately on root app) ---

export async function handleRedirect(c: any): Promise<Response> {
  const slug = c.req.param('slug');
  const db = getDb(c.env.DATABASE_URL);
  const link = await db.getShortLinkBySlug(slug);

  if (!link) return c.json({ error: 'Not found' }, 404);

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return c.json({ error: 'This link has expired' }, 410);
  }

  const ua = c.req.header('User-Agent') || '';
  const country = c.req.header('CF-IPCountry') || null;
  const referrer = c.req.header('Referer') || null;

  c.executionCtx.waitUntil(
    db.createEvent({
      id: crypto.randomUUID(),
      project_id: link.project_id,
      name: 'link_click',
      url: link.destination,
      referrer,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      country,
      device: parseDevice(ua),
      browser: parseBrowser(ua),
      screen_width: null,
      properties: { link_id: link.id, slug: link.slug, title: link.title },
    }).then(() => db.incrementLinkClickCount(link.id))
  );

  return c.redirect(link.destination, 302);
}

// --- API key auth routes ---

links.post('/', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const body = (await c.req.json()) as CreateShortLinkRequest;

  if (!body.destination?.trim()) return c.json({ error: 'destination is required' }, 400);
  if (!URL_RE.test(body.destination)) return c.json({ error: 'destination must be a valid http/https URL' }, 400);
  if (body.slug && !SLUG_RE.test(body.slug)) return c.json({ error: 'slug may only contain A-Z, a-z, 0-9, _ and - (max 64 chars)' }, 400);

  const slug = body.slug?.trim() || generateSlug();
  const db = getDb(c.env.DATABASE_URL);

  try {
    const record = await db.createShortLink({
      id: crypto.randomUUID(),
      project_id: projectId,
      slug,
      destination: body.destination.trim(),
      title: body.title?.trim() || null,
      expires_at: body.expires_at || null,
    });
    return c.json(record, 201);
  } catch (e: any) {
    if (e.message?.includes('duplicate') || e.code === '23505') {
      return c.json({ error: `Slug "${slug}" is already taken` }, 409);
    }
    throw e;
  }
});

links.get('/', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const page = parseInt(c.req.query('page') || '1', 10);
  const db = getDb(c.env.DATABASE_URL);
  const result = await db.listShortLinks(projectId, page, PAGE_SIZE);
  return c.json({ data: result.data, total: result.total, page, limit: PAGE_SIZE });
});

links.get('/dashboard/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const page = parseInt(c.req.query('page') || '1', 10);
  const db = getDb(c.env.DATABASE_URL);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const result = await db.listShortLinks(projectId, page, PAGE_SIZE);
  return c.json({ data: result.data, total: result.total, page, limit: PAGE_SIZE });
});

links.get('/dashboard/:projectId/stats/:id', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const linkId = c.req.param('id');
  const db = getDb(c.env.DATABASE_URL);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const link = await db.getShortLinkById(linkId);
  if (!link || link.project_id !== projectId) return c.json({ error: 'Not found' }, 404);

  const stats = await db.getShortLinkStats(linkId, projectId);
  return c.json(stats);
});

links.get('/:id', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const id = c.req.param('id');
  const db = getDb(c.env.DATABASE_URL);

  const link = await db.getShortLinkById(id);
  if (!link) return c.json({ error: 'Not found' }, 404);
  if (link.project_id !== projectId) return c.json({ error: 'Forbidden' }, 403);
  return c.json(link);
});

links.patch('/:id', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const id = c.req.param('id');
  const body = (await c.req.json()) as UpdateShortLinkRequest;
  const db = getDb(c.env.DATABASE_URL);

  const existing = await db.getShortLinkById(id);
  if (!existing) return c.json({ error: 'Not found' }, 404);
  if (existing.project_id !== projectId) return c.json({ error: 'Forbidden' }, 403);

  if (body.destination && !URL_RE.test(body.destination)) {
    return c.json({ error: 'destination must be a valid http/https URL' }, 400);
  }

  const updated = await db.updateShortLink(id, {
    destination: body.destination?.trim(),
    title: body.title?.trim(),
    expires_at: body.expires_at,
  });
  return c.json(updated);
});

links.delete('/:id', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const id = c.req.param('id');
  const db = getDb(c.env.DATABASE_URL);

  const existing = await db.getShortLinkById(id);
  if (!existing) return c.json({ error: 'Not found' }, 404);
  if (existing.project_id !== projectId) return c.json({ error: 'Forbidden' }, 403);

  await db.deleteShortLink(id);
  return c.json({ ok: true });
});

export { links };
```

**Step 4: Mount routes in index.ts**

In `workers/api/src/index.ts`:
- Add import: `import { links, handleRedirect } from './routes/links';`
- Add before the `/v1/` routes: `app.get('/r/:slug', handleRedirect);`
- Add with other routes: `app.route('/v1/links', links);`

**Step 5: Run tests to verify they pass**

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker && pnpm vitest run tests/api/links.test.ts
```

Expected: 7/7 PASS

**Step 6: Run all tests**

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker && pnpm vitest run
```

Expected: All tests pass (existing + 7 new).

**Step 7: Commit**

```bash
git add workers/api/src/routes/links.ts workers/api/src/index.ts tests/api/links.test.ts
git commit -m "feat: add short URL routes and tests"
```

---

### Task 5: Run Short Links Migration

**Step 1: Run migration against CockroachDB**

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker && cat packages/db/migrations/0005_short_links.sql | cockroach sql --url "$DATABASE_URL"
```

If `cockroach` CLI is not available, use:
```bash
psql "$DATABASE_URL" -f packages/db/migrations/0005_short_links.sql
```

**Step 2: Verify tables**

```bash
psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
```

Expected: `short_links` appears in the list (11 tables total).

**Step 3: Commit (no code change, just note)**

No commit needed — migration is a DB operation.

---

### Task 6: Wire Shared Types in Dashboard + API Client

**Files:**
- Modify: `apps/dashboard/package.json`
- Create: `apps/dashboard/src/lib/api-client.ts`
- Delete: `apps/dashboard/src/components/feedback-types.ts`
- Modify: All files that import from `feedback-types`

**Step 1: Add shared-types workspace dependency**

In `apps/dashboard/package.json`, add to `dependencies`:
```json
"@saasmaker/shared-types": "workspace:*"
```

Run: `cd /Users/sarthakagrawal/Desktop/saas-maker && pnpm install`

**Step 2: Create api-client.ts**

Create `apps/dashboard/src/lib/api-client.ts`:

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

/** Server-side fetch with session token auto-attached */
export async function apiFetchAuthed<T>(path: string, init?: RequestInit): Promise<T> {
  const { getServerToken } = await import("./api");
  const token = await getServerToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string>),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

/** Client-side fetch — pass token from /api/token */
export async function apiFetchClient<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string>),
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

/** Get auth token from client-side /api/token endpoint */
export async function getClientToken(): Promise<string> {
  const res = await fetch("/api/token");
  if (!res.ok) throw new Error("Failed to get auth token");
  const data = await res.json();
  return data.token;
}
```

**Step 3: Replace feedback-types imports**

Find all files importing from `@/components/feedback-types` and change to `@saasmaker/shared-types`:
- `apps/dashboard/src/app/projects/page.tsx` — `import type { ProjectRecord } from '@saasmaker/shared-types';`
- `apps/dashboard/src/app/projects/[slug]/page.tsx` — same
- `apps/dashboard/src/app/projects/[slug]/inbox-content.tsx` — `import type { FeedbackRecord, FeedbackStatus } from '@saasmaker/shared-types';`
- `apps/dashboard/src/app/projects/[slug]/settings/settings-form.tsx` — `import type { ProjectRecord } from '@saasmaker/shared-types';`
- `apps/dashboard/src/components/feedback-table.tsx` — check and update
- `apps/dashboard/src/components/feedback-detail.tsx` — check and update
- `apps/dashboard/src/components/filter-bar.tsx` — check and update

After updating all imports, delete `apps/dashboard/src/components/feedback-types.ts`.

**Step 4: Verify build**

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker/apps/dashboard && pnpm build
```

Expected: Build succeeds.

**Step 5: Commit**

```bash
git add apps/dashboard/package.json apps/dashboard/src/lib/api-client.ts pnpm-lock.yaml
git add -u apps/dashboard/src/  # catches the deleted file + modified imports
git commit -m "feat: wire shared-types in dashboard, add typed api-client"
```

---

### Task 7: Install shadcn Components + Recharts

**Files:**
- Modify: `apps/dashboard/package.json` (via commands)
- Create: new shadcn UI component files

**Step 1: Install new shadcn components**

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker/apps/dashboard
pnpm dlx shadcn@latest add sidebar separator skeleton tooltip chart
```

**Step 2: Install recharts**

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker/apps/dashboard && pnpm add recharts
```

**Step 3: Verify build**

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker/apps/dashboard && pnpm build
```

**Step 4: Commit**

```bash
git add apps/dashboard/
git commit -m "feat: install shadcn sidebar, chart, skeleton, tooltip, separator + recharts"
```

---

### Task 8: Reusable Shared Components

**Files:**
- Create: `apps/dashboard/src/components/page-header.tsx`
- Create: `apps/dashboard/src/components/stat-card.tsx`
- Create: `apps/dashboard/src/components/empty-state.tsx`
- Create: `apps/dashboard/src/components/table-skeleton.tsx`

**Step 1: Create PageHeader**

Create `apps/dashboard/src/components/page-header.tsx`:

```tsx
import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
```

**Step 2: Create StatCard**

Create `apps/dashboard/src/components/stat-card.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  description?: string;
}

export function StatCard({ title, value, icon: Icon, description }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}
```

**Step 3: Create EmptyState**

Create `apps/dashboard/src/components/empty-state.tsx`:

```tsx
import { type LucideIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="py-16">
      <CardHeader className="flex flex-col items-center text-center">
        <Icon className="h-12 w-12 text-muted-foreground mb-4" />
        <CardTitle>{title}</CardTitle>
        <CardDescription className="mt-2 max-w-sm">{description}</CardDescription>
        {action && <div className="mt-4">{action}</div>}
      </CardHeader>
    </Card>
  );
}
```

**Step 4: Create TableSkeleton**

Create `apps/dashboard/src/components/table-skeleton.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="rounded-md border">
      {/* Header */}
      <div className="border-b p-3 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b p-3 flex gap-4 items-center">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add apps/dashboard/src/components/page-header.tsx apps/dashboard/src/components/stat-card.tsx apps/dashboard/src/components/empty-state.tsx apps/dashboard/src/components/table-skeleton.tsx
git commit -m "feat: add reusable PageHeader, StatCard, EmptyState, TableSkeleton components"
```

---

### Task 9: Sidebar Layout

**Files:**
- Rewrite: `apps/dashboard/src/app/projects/layout.tsx`
- Rewrite: `apps/dashboard/src/app/projects/[slug]/page.tsx` (will be updated to work with sidebar nav context)

This is the biggest visual change. Replace the top-nav layout with a sidebar layout.

**Step 1: Rewrite projects/layout.tsx**

Replace the entire contents of `apps/dashboard/src/app/projects/layout.tsx` with a sidebar layout using shadcn's `Sidebar` component (or a custom sidebar if the shadcn sidebar component doesn't install properly). The sidebar should contain:

- Logo at top (`SaaS Maker` text link to /projects)
- Navigation section with icons:
  - Inbox (MessageSquare icon) — `/projects/[slug]`
  - Waitlist (Users icon) — `/projects/[slug]/waitlist`
  - Analytics (BarChart3 icon) — `/projects/[slug]/analytics`
  - Short Links (Link icon) — `/projects/[slug]/links`
  - Settings (Settings icon) — `/projects/[slug]/settings`
- Navigation items are only shown when inside a project (the slug is in the URL)
- At top: a "Projects" breadcrumb/link that goes back to /projects list
- User menu at bottom with avatar + sign out

The layout should use a `usePathname()` hook (client component) or segment detection to highlight the active nav item. Since the layout.tsx is a server component, create a `sidebar-nav.tsx` client component that reads `usePathname()`.

**Key implementation notes:**
- The sidebar should work without the shadcn Sidebar component if it's not available — use a simple `<aside>` with Tailwind classes
- Mobile: use shadcn `Sheet` for mobile nav (already installed)
- Extract the slug from the URL path to build nav links

**Step 2: Create sidebar-nav client component**

Create `apps/dashboard/src/components/sidebar-nav.tsx` as a `"use client"` component:
- Reads `usePathname()` to determine active item
- Extracts project slug from path (regex: `/projects/([^/]+)`)
- Renders nav items only if slug is present
- Uses Lucide icons for each nav item
- Highlights active item with `bg-muted` + `text-foreground`

**Step 3: Verify build + dev server**

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker/apps/dashboard && pnpm build
```

**Step 4: Commit**

```bash
git add apps/dashboard/src/app/projects/layout.tsx apps/dashboard/src/components/sidebar-nav.tsx
git commit -m "feat: replace top-nav with sidebar layout"
```

---

### Task 10: Restyle Projects List Page

**Files:**
- Modify: `apps/dashboard/src/app/projects/page.tsx`

**Step 1: Restyle with shared components**

Update the page to use `PageHeader` and `EmptyState`. Replace the inline empty state with the reusable `EmptyState` component. Keep the existing project card grid.

**Step 2: Verify build**

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker/apps/dashboard && pnpm build
```

**Step 3: Commit**

```bash
git add apps/dashboard/src/app/projects/page.tsx
git commit -m "feat: restyle projects list with reusable components"
```

---

### Task 11: Restyle Feedback Inbox Page

**Files:**
- Modify: `apps/dashboard/src/app/projects/[slug]/page.tsx`

**Step 1: Restyle with shared components**

Replace the inline header with `PageHeader`. Keep the Quick Setup card and `InboxContent` Suspense boundary. Remove the Settings button from the header (Settings is now in sidebar nav).

**Step 2: Commit**

```bash
git add apps/dashboard/src/app/projects/[slug]/page.tsx
git commit -m "feat: restyle feedback inbox with PageHeader"
```

---

### Task 12: Waitlist Dashboard Page

**Files:**
- Create: `apps/dashboard/src/app/projects/[slug]/waitlist/page.tsx`

**Step 1: Create the waitlist page**

Create `apps/dashboard/src/app/projects/[slug]/waitlist/page.tsx`:

- Server component with `export const dynamic = "force-dynamic"`
- Auth check: `await auth()`, redirect if no session
- Fetch project by slug (same pattern as inbox page)
- Fetch waitlist data from `GET /v1/waitlist?project_id=xxx` with session token
- Display: `PageHeader` (title "Waitlist", action = copy count badge)
- `StatCard` row: total signups
- Table: position, email, name, date
- Delete button per row (client component wrapper needed for interaction)
- Quick setup card with waitlist SDK snippet

**Step 2: Verify build**

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker/apps/dashboard && pnpm build
```

**Step 3: Commit**

```bash
git add apps/dashboard/src/app/projects/[slug]/waitlist/
git commit -m "feat: add waitlist dashboard page"
```

---

### Task 13: Analytics Dashboard Page

**Files:**
- Create: `apps/dashboard/src/app/projects/[slug]/analytics/page.tsx`
- Create: `apps/dashboard/src/app/projects/[slug]/analytics/analytics-content.tsx`

This is the most complex dashboard page — dark theme, Recharts, multiple API calls.

**Step 1: Create the analytics page (server component)**

`apps/dashboard/src/app/projects/[slug]/analytics/page.tsx`:
- Auth check, fetch project by slug
- Render `PageHeader` (title "Analytics") + period selector tabs (7d/30d/90d)
- Wrap `AnalyticsContent` in Suspense

**Step 2: Create analytics-content.tsx (client component)**

`apps/dashboard/src/app/projects/[slug]/analytics/analytics-content.tsx`:
- `"use client"` component
- Fetches from all 6 analytics endpoints with the selected period
- Uses `StatCard` for overview (page views, unique visitors, top page, top referrer)
- Recharts `AreaChart` for page views over time (use `/v1/analytics/pages` data or add a time-series endpoint)
- Recharts `BarChart` for top pages and top referrers
- Recharts `PieChart` for devices and browsers
- Table for country breakdown
- Dark theme: wrap in `<div className="dark">` or use a dark card variant with `bg-zinc-950 text-zinc-50` on the analytics section
- Analytics SDK setup card with script tag snippet

**Step 3: Verify build**

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker/apps/dashboard && pnpm build
```

**Step 4: Commit**

```bash
git add apps/dashboard/src/app/projects/[slug]/analytics/
git commit -m "feat: add analytics dashboard page with Recharts charts"
```

---

### Task 14: Short Links Dashboard Page

**Files:**
- Create: `apps/dashboard/src/app/projects/[slug]/links/page.tsx`
- Create: `apps/dashboard/src/app/projects/[slug]/links/links-content.tsx`
- Create: `apps/dashboard/src/app/projects/[slug]/links/create-link-dialog.tsx`

**Step 1: Create the page (server component)**

`apps/dashboard/src/app/projects/[slug]/links/page.tsx`:
- Auth check, fetch project by slug
- Render `PageHeader` (title "Short Links", action = `CreateLinkDialog`)
- Wrap `LinksContent` in Suspense

**Step 2: Create links-content.tsx (client component)**

- Fetches from `GET /v1/links/dashboard/:projectId`
- Table: short URL (with copy button), destination (truncated), title, clicks, created date, expires, actions (edit/delete)
- `EmptyState` when no links exist

**Step 3: Create create-link-dialog.tsx (client component)**

- Dialog with form: destination URL (required), custom slug (optional, placeholder shows auto-generated), title (optional), expiration (optional date input)
- Posts to `POST /v1/links` with API key
- On success: refreshes the page

**Step 4: Verify build**

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker/apps/dashboard && pnpm build
```

**Step 5: Commit**

```bash
git add apps/dashboard/src/app/projects/[slug]/links/
git commit -m "feat: add short links dashboard page with create dialog"
```

---

### Task 15: Restyle Settings Page

**Files:**
- Modify: `apps/dashboard/src/app/projects/[slug]/settings/page.tsx`
- Modify: `apps/dashboard/src/app/projects/[slug]/settings/settings-form.tsx`

**Step 1: Update settings page**

Remove the back arrow button (sidebar handles navigation now). Use `PageHeader` component. Keep the rest of the settings form as-is since it already uses shadcn Card, Input, Label, Button.

**Step 2: Commit**

```bash
git add apps/dashboard/src/app/projects/[slug]/settings/
git commit -m "feat: restyle settings page, remove back arrow (sidebar nav)"
```

---

### Task 16: Final Verification

**Step 1: Run all API tests**

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker && pnpm vitest run
```

Expected: All tests pass.

**Step 2: Build dashboard**

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker/apps/dashboard && pnpm build
```

Expected: Build succeeds.

**Step 3: Verify dev server**

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker/apps/dashboard && pnpm dev
```

Check manually:
- `/projects` — grid of project cards
- `/projects/[slug]` — feedback inbox with sidebar nav
- `/projects/[slug]/waitlist` — waitlist table
- `/projects/[slug]/analytics` — dark analytics view with charts
- `/projects/[slug]/links` — short links table
- `/projects/[slug]/settings` — settings form
- Sidebar highlights active page
- Mobile responsive (sidebar collapses)
