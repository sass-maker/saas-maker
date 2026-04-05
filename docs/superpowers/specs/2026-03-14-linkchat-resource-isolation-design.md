# LinkChat Resource Isolation Design

## Problem

LinkChat auto-provisions SaaS Maker users and creates projects on their behalf. These system-managed projects appear alongside user-created projects in the SaaS Maker dashboard, polluting the UI. LinkChat users never need to see or manage these resources directly — LinkChat handles everything via API and SDK.

## Solution

Add a `source` column to the `projects` table to distinguish who created a project. Dashboard queries filter by `source = 'dashboard'` by default, hiding integration-managed projects.

## Design

### 1. Schema Change

New migration: `0018_project_source.sql`

```sql
ALTER TABLE projects ADD COLUMN source VARCHAR(50) NOT NULL DEFAULT 'dashboard';
```

Values:
- `'dashboard'` — default, user-created via SaaS Maker UI
- `'linkchat'` — created by LinkChat integration

Future integrations add their own source value without schema changes. No CHECK constraint — extensibility without migrations is preferred.

### 2. Type Changes

Add `source` to `ProjectRecord` in `packages/shared-types/src/index.ts`:

```typescript
source: 'dashboard' | 'linkchat' | string;
```

Union with `string` for extensibility without type changes.

`source` is immutable after creation — it must NOT be added to the `updateProject` pick type.

### 3. Database Query Changes

**`createProject`** — Add `source` to the input type and INSERT statement in both `packages/db/src/index.ts` and `workers/api/src/db.ts`. Defaults to `'dashboard'` if omitted.

**`listProjectsByOwner`** — Add optional `source` filter parameter:

```typescript
listProjectsByOwner(ownerId: string, source?: string)
```

Behavior:
- `source` omitted or `'dashboard'` (default) — `WHERE owner_id = ? AND source = 'dashboard'`
- `source = 'all'` — `WHERE owner_id = ?` (no source filter)
- `source = 'linkchat'` — `WHERE owner_id = ? AND source = 'linkchat'`

No changes to resource queries (feedback, indexes, forms, etc.) — they are already scoped by `project_id`. Hiding the project from listing hides all its resources.

No new index needed — the existing `idx_projects_owner` on `owner_id` is sufficient given low row counts per user.

### 4. API Changes

**`POST /v1/projects`** — Accept optional `source` field in request body. Validated against an allowlist: `['dashboard', 'linkchat']`. Unknown values rejected with 400. Default to `'dashboard'`.

**`GET /v1/projects`** (session-authenticated, dashboard) — Filter by `source = 'dashboard'` by default. Optional `?source=linkchat` or `?source=all` query param for explicit override.

**`GET /v1/projects/by-slug/:slug`** and **`GET /v1/projects/:id`** — No source filtering. These are direct-access endpoints; if you know the slug/id, you can access the project. This is intentional: the goal is UI isolation (hiding from listing), not access control.

**API-key authenticated endpoints** — No changes. Resource access via API key is unaffected by `source`.

### 5. SDK Changes

The SDK (`packages/sdk`) currently has no `createProject` method — it authenticates via API key, which is already scoped to a single project. No SDK changes needed. LinkChat creates projects by calling the REST API directly with session auth.

## What Does Not Change

- All resource endpoints (feedback, indexes, forms, analytics, etc.)
- API key authentication and authorization
- Dashboard components (they consume whatever the listing query returns)
- CLI behavior
- Direct project access by slug/id (intentional — UI isolation, not access control)
- `updateProject` — `source` is not an updatable field

## Scope

This is the first integration that auto-provisions users and manages resources on their behalf. The SDK/CLI are used by developers who intentionally manage their own projects — those are not affected.
