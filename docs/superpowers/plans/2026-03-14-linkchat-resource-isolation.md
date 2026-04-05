# LinkChat Resource Isolation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `source` column to the `projects` table so LinkChat-created projects are hidden from the SaaS Maker dashboard by default.

**Architecture:** Single new column `source VARCHAR(50) NOT NULL DEFAULT 'dashboard'` on the `projects` table. Dashboard queries filter by `source = 'dashboard'`. API accepts `source` on project creation with allowlist validation. No new tables or endpoints.

**Tech Stack:** PostgreSQL (CockroachDB), TypeScript, Hono (Cloudflare Workers), pnpm monorepo

**Spec:** `docs/superpowers/specs/2026-03-14-linkchat-resource-isolation-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `packages/db/migrations/0018_project_source.sql` | Create | Migration to add `source` column |
| `packages/shared-types/src/index.ts` | Modify | Add `source` to `ProjectRecord` and `CreateProjectRequest` |
| `packages/db/src/index.ts` | Modify | Update `createProject` input type and `listProjectsByOwner` signature |
| `workers/api/src/db.ts` | Modify | Update `createProject` INSERT and `listProjectsByOwner` query |
| `workers/api/src/routes/projects.ts` | Modify | Accept `source` on POST, filter on GET |
| `workers/api/src/routes/feedback.ts` | Modify | Pass source filter to `listProjectsByOwner` in `/board` |

---

## Task 1: Add database migration

**Files:**
- Create: `packages/db/migrations/0018_project_source.sql`

- [ ] **Step 1: Create migration file**

```sql
-- 0018_project_source.sql
-- Add source column to projects for integration isolation (e.g., LinkChat)
ALTER TABLE projects ADD COLUMN source VARCHAR(50) NOT NULL DEFAULT 'dashboard';
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/migrations/0018_project_source.sql
git commit -m "feat: add source column migration for project isolation"
```

---

## Task 2: Update shared types

**Files:**
- Modify: `packages/shared-types/src/index.ts:16-27` (ProjectRecord)
- Modify: `packages/shared-types/src/index.ts:54-56` (CreateProjectRequest)

- [ ] **Step 1: Add `source` to `ProjectRecord`**

In `packages/shared-types/src/index.ts`, add `source` field to `ProjectRecord` after `readme`:

```typescript
export interface ProjectRecord {
  id: string;
  name: string;
  slug: string;
  api_key: string;
  owner_id: string;
  embedding_model: string | null;
  rate_limit_rpm: number;
  rate_limit_enabled: boolean;
  readme: string | null;
  source: 'dashboard' | 'linkchat' | string;
  created_at: string;
}
```

- [ ] **Step 2: Add `source` to `CreateProjectRequest`**

```typescript
export interface CreateProjectRequest {
  name: string;
  source?: string;
}
```

- [ ] **Step 3: Verify types compile**

Run: `pnpm --filter @saas-maker/shared-types build`
Expected: Success, no errors

- [ ] **Step 4: Commit**

```bash
git add packages/shared-types/src/index.ts
git commit -m "feat: add source field to ProjectRecord and CreateProjectRequest"
```

---

## Task 3: Update database interface and implementation

**Files:**
- Modify: `packages/db/src/index.ts:32` (createProject input)
- Modify: `packages/db/src/index.ts:36` (listProjectsByOwner signature)
- Modify: `workers/api/src/db.ts:79-86` (createProject SQL)
- Modify: `workers/api/src/db.ts:103-106` (listProjectsByOwner SQL)

- [ ] **Step 1: Update `createProject` input in interface**

In `packages/db/src/index.ts`, update line 32:

```typescript
createProject(input: { id: string; name: string; slug: string; api_key: string; owner_id: string; source?: string }): Promise<ProjectRecord>;
```

- [ ] **Step 2: Update `listProjectsByOwner` signature in interface**

In `packages/db/src/index.ts`, update line 36:

```typescript
listProjectsByOwner(ownerId: string, source?: string): Promise<ProjectRecord[]>;
```

- [ ] **Step 3: Update `createProject` SQL in `workers/api/src/db.ts`**

At line 79-86, update the INSERT to include `source`:

```typescript
async createProject(input) {
  const source = input.source || 'dashboard';
  const [row] = await sql`
    INSERT INTO projects (id, name, slug, api_key, owner_id, source)
    VALUES (${input.id}, ${input.name}, ${input.slug}, ${input.api_key}, ${input.owner_id}, ${source})
    RETURNING *
  `;
  return row as ProjectRecord;
},
```

- [ ] **Step 4: Update `listProjectsByOwner` SQL in `workers/api/src/db.ts`**

At line 103-106, add source filtering:

```typescript
async listProjectsByOwner(ownerId, source) {
  if (source === 'all') {
    const rows = await sql`SELECT * FROM projects WHERE owner_id = ${ownerId} ORDER BY created_at DESC`;
    return rows as unknown as ProjectRecord[];
  }
  const filterSource = source || 'dashboard';
  const rows = await sql`SELECT * FROM projects WHERE owner_id = ${ownerId} AND source = ${filterSource} ORDER BY created_at DESC`;
  return rows as unknown as ProjectRecord[];
},
```

- [ ] **Step 5: Verify types compile**

Run: `pnpm --filter @saas-maker/db build && pnpm --filter api typecheck`
Expected: Success, no errors

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/index.ts workers/api/src/db.ts
git commit -m "feat: add source param to createProject and listProjectsByOwner"
```

---

## Task 4: Update API routes

**Files:**
- Modify: `workers/api/src/routes/projects.ts:27-31` (GET /)
- Modify: `workers/api/src/routes/projects.ts:34-49` (POST /)
- Modify: `workers/api/src/routes/feedback.ts:129` (GET /board)

- [ ] **Step 1: Update `GET /v1/projects` to filter by source**

In `workers/api/src/routes/projects.ts`, update lines 27-32:

```typescript
projects.get('/', async (c) => {
  const userId = c.get('userId')!;
  const source = c.req.query('source') || 'dashboard';
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const data = await db.listProjectsByOwner(userId, source);
  return c.json({ data });
});
```

- [ ] **Step 2: Update `POST /v1/projects` to accept and validate source**

In `workers/api/src/routes/projects.ts`, update lines 34-49:

```typescript
const VALID_SOURCES = ['dashboard', 'linkchat'];

projects.post('/', async (c) => {
  const userId = c.get('userId')!;
  const body = (await c.req.json()) as { name: string; source?: string };
  if (!body.name?.trim()) return c.json({ error: 'Project name is required' }, 400);

  const source = body.source || 'dashboard';
  if (!VALID_SOURCES.includes(source)) {
    return c.json({ error: `Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}` }, 400);
  }

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.createProject({
    id: crypto.randomUUID(),
    name: body.name.trim(),
    slug: slugify(body.name) + '-' + Date.now().toString(36),
    api_key: generateApiKey(),
    owner_id: userId,
    source,
  });

  return c.json(project, 201);
});
```

- [ ] **Step 3: Update feedback board route to filter by source**

In `workers/api/src/routes/feedback.ts`, update line 129:

```typescript
const projects = await db.listProjectsByOwner(userId, 'dashboard');
```

- [ ] **Step 4: Verify build**

Run: `pnpm --filter api typecheck`
Expected: Success, no errors

- [ ] **Step 5: Commit**

```bash
git add workers/api/src/routes/projects.ts workers/api/src/routes/feedback.ts
git commit -m "feat: filter projects by source in API routes"
```

---

## Task 5: Run migration and verify end-to-end

- [ ] **Step 1: Run the migration against the database**

Run: `pnpm --filter @saas-maker/db migrate` (or the project's migration command)

- [ ] **Step 2: Build all affected packages**

Run: `pnpm build --filter @saas-maker/shared-types --filter @saas-maker/db --filter api`

- [ ] **Step 3: Run existing tests to verify no regressions**

Run: `pnpm test`
Expected: All existing tests pass

- [ ] **Step 4: Commit any remaining changes and push**

```bash
git push origin main
```
