# Roadmap Kanban Board Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a public Kanban roadmap board per project with drag-and-drop, feedback promotion, voting, and private/public card visibility.

**Architecture:** New `roadmap_items` + `roadmap_votes` tables, new Hono route file, new dashboard Kanban page with `@dnd-kit`, new public page at `/roadmap/[slug]`, and feedback page augmented with "Move to Roadmap" action. Note: `/r/:slug` is already used by short link redirects, so public roadmap URL is `/roadmap/[slug]` on the Next.js side.

**Tech Stack:** CockroachDB (postgres), Hono worker API, Next.js 15, `@dnd-kit/core` + `@dnd-kit/sortable`, shadcn/ui components.

---

### Task 1: Add shared types for roadmap

**Files:**
- Modify: `packages/shared-types/src/index.ts`

**Step 1: Add roadmap types**

Append these types at the end of the file (before the closing, after the AI Gateway section):

```ts
// --- Roadmap ---

export type RoadmapColumn = 'backlog' | 'planned' | 'in_progress' | 'done';

export interface RoadmapItemRecord {
  id: string;
  project_id: string;
  feedback_id: string | null;
  title: string;
  description: string | null;
  column: RoadmapColumn;
  position: number;
  public: boolean;
  upvote_count: number;
  downvote_count: number;
  created_at: string;
  updated_at: string;
}

export interface RoadmapVoteRecord {
  id: string;
  roadmap_item_id: string;
  user_identifier: string;
  vote: 1 | -1;
  created_at: string;
}

export interface CreateRoadmapItemRequest {
  title: string;
  description?: string;
  column?: RoadmapColumn;
  public?: boolean;
}

export interface UpdateRoadmapItemRequest {
  title?: string;
  description?: string;
  column?: RoadmapColumn;
  position?: number;
  public?: boolean;
}

export interface ReorderRoadmapRequest {
  items: { id: string; column: RoadmapColumn; position: number }[];
}
```

**Step 2: Commit**

```bash
git add packages/shared-types/src/index.ts
git commit -m "feat: add roadmap shared types"
```

---

### Task 2: Add roadmap database schema and methods

**Files:**
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/index.ts`
- Modify: `workers/api/src/db.ts`

**Step 1: Add table names to schema.ts**

Add to the TABLES object in `packages/db/src/schema.ts`:

```ts
  roadmap_items: 'roadmap_items',
  roadmap_votes: 'roadmap_votes',
```

**Step 2: Add interface methods to packages/db/src/index.ts**

Add to the `FeedbackDatabase` interface, before the closing `}`:

```ts
  // Roadmap
  createRoadmapItem(input: {
    id: string; project_id: string; feedback_id: string | null;
    title: string; description: string | null; column: string;
    position: number; public: boolean;
  }): Promise<import('@saas-maker/shared-types').RoadmapItemRecord>;
  getRoadmapItemById(id: string): Promise<import('@saas-maker/shared-types').RoadmapItemRecord | null>;
  listRoadmapItems(projectId: string, publicOnly?: boolean): Promise<import('@saas-maker/shared-types').RoadmapItemRecord[]>;
  updateRoadmapItem(id: string, input: {
    title?: string; description?: string; column?: string;
    position?: number; public?: boolean;
  }): Promise<import('@saas-maker/shared-types').RoadmapItemRecord | null>;
  deleteRoadmapItem(id: string): Promise<boolean>;
  batchUpdateRoadmapPositions(items: { id: string; column: string; position: number }[]): Promise<void>;
  getNextRoadmapPosition(projectId: string, column: string): Promise<number>;

  // Roadmap Votes
  setRoadmapVote(input: { id: string; roadmap_item_id: string; user_identifier: string; vote: 1 | -1 }): Promise<void>;
  removeRoadmapVote(roadmapItemId: string, userIdentifier: string): Promise<boolean>;
  getRoadmapVote(roadmapItemId: string, userIdentifier: string): Promise<1 | -1 | null>;
```

**Step 3: Add DB implementation to workers/api/src/db.ts**

First add `RoadmapItemRecord` to the imports at top of file:

```ts
import type {
  // ... existing imports ...
  RoadmapItemRecord,
} from '@saas-maker/shared-types';
```

Then add the implementations before the closing `};` of the `createDatabase` return object. Place after the CLI Auth section:

```ts
    // --- Roadmap ---
    async createRoadmapItem(input) {
      const [row] = await sql`
        INSERT INTO roadmap_items (id, project_id, feedback_id, title, description, "column", position, public)
        VALUES (${input.id}, ${input.project_id}, ${input.feedback_id}, ${input.title}, ${input.description}, ${input.column}, ${input.position}, ${input.public})
        RETURNING *
      `;
      return row as RoadmapItemRecord;
    },

    async getRoadmapItemById(id) {
      const [row] = await sql`SELECT * FROM roadmap_items WHERE id = ${id}`;
      return (row as RoadmapItemRecord) || null;
    },

    async listRoadmapItems(projectId, publicOnly = false) {
      if (publicOnly) {
        const rows = await sql`
          SELECT * FROM roadmap_items
          WHERE project_id = ${projectId} AND public = true
          ORDER BY "column", position
        `;
        return rows as unknown as RoadmapItemRecord[];
      }
      const rows = await sql`
        SELECT * FROM roadmap_items
        WHERE project_id = ${projectId}
        ORDER BY "column", position
      `;
      return rows as unknown as RoadmapItemRecord[];
    },

    async updateRoadmapItem(id, input) {
      const sets = [];
      if (input.title !== undefined) sets.push(sql`title = ${input.title}`);
      if (input.description !== undefined) sets.push(sql`description = ${input.description}`);
      if (input.column !== undefined) sets.push(sql`"column" = ${input.column}`);
      if (input.position !== undefined) sets.push(sql`position = ${input.position}`);
      if (input.public !== undefined) sets.push(sql`public = ${input.public}`);
      sets.push(sql`updated_at = NOW()`);

      const setClause = sets.reduce((acc, s, i) => i === 0 ? s : sql`${acc}, ${s}`);
      const [row] = await sql`UPDATE roadmap_items SET ${setClause} WHERE id = ${id} RETURNING *`;
      return (row as RoadmapItemRecord) || null;
    },

    async deleteRoadmapItem(id) {
      const result = await sql`DELETE FROM roadmap_items WHERE id = ${id}`;
      return result.count > 0;
    },

    async batchUpdateRoadmapPositions(items) {
      for (const item of items) {
        await sql`
          UPDATE roadmap_items
          SET "column" = ${item.column}, position = ${item.position}, updated_at = NOW()
          WHERE id = ${item.id}
        `;
      }
    },

    async getNextRoadmapPosition(projectId, column) {
      const [row] = await sql`
        SELECT COALESCE(MAX(position), -1) + 1 AS next_pos
        FROM roadmap_items
        WHERE project_id = ${projectId} AND "column" = ${column}
      `;
      return (row as any).next_pos as number;
    },

    // --- Roadmap Votes ---
    async setRoadmapVote(input) {
      await sql`
        INSERT INTO roadmap_votes (id, roadmap_item_id, user_identifier, vote)
        VALUES (${input.id}, ${input.roadmap_item_id}, ${input.user_identifier}, ${input.vote})
        ON CONFLICT (roadmap_item_id, user_identifier) DO UPDATE SET vote = ${input.vote}
      `;
      // Update counts
      const [counts] = await sql`
        SELECT
          COALESCE(SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END), 0) AS up,
          COALESCE(SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END), 0) AS down
        FROM roadmap_votes WHERE roadmap_item_id = ${input.roadmap_item_id}
      `;
      await sql`
        UPDATE roadmap_items
        SET upvote_count = ${(counts as any).up}, downvote_count = ${(counts as any).down}
        WHERE id = ${input.roadmap_item_id}
      `;
    },

    async removeRoadmapVote(roadmapItemId, userIdentifier) {
      const result = await sql`
        DELETE FROM roadmap_votes
        WHERE roadmap_item_id = ${roadmapItemId} AND user_identifier = ${userIdentifier}
      `;
      if (result.count > 0) {
        const [counts] = await sql`
          SELECT
            COALESCE(SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END), 0) AS up,
            COALESCE(SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END), 0) AS down
          FROM roadmap_votes WHERE roadmap_item_id = ${roadmapItemId}
        `;
        await sql`
          UPDATE roadmap_items
          SET upvote_count = ${(counts as any).up}, downvote_count = ${(counts as any).down}
          WHERE id = ${roadmapItemId}
        `;
      }
      return result.count > 0;
    },

    async getRoadmapVote(roadmapItemId, userIdentifier) {
      const [row] = await sql`
        SELECT vote FROM roadmap_votes
        WHERE roadmap_item_id = ${roadmapItemId} AND user_identifier = ${userIdentifier}
      `;
      if (!row) return null;
      return (row as any).vote === 1 ? 1 : -1;
    },
```

**Step 4: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/index.ts workers/api/src/db.ts
git commit -m "feat: add roadmap database schema and methods"
```

---

### Task 3: Create database migration

**Files:**
- Create: `packages/db/migrations/007_roadmap.sql`

**Step 1: Write the migration SQL**

```sql
-- Roadmap items
CREATE TABLE IF NOT EXISTS roadmap_items (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  feedback_id UUID REFERENCES feedback(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  "column" TEXT NOT NULL DEFAULT 'backlog',
  position INT NOT NULL DEFAULT 0,
  public BOOLEAN NOT NULL DEFAULT true,
  upvote_count INT NOT NULL DEFAULT 0,
  downvote_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_roadmap_items_project ON roadmap_items(project_id);
CREATE INDEX idx_roadmap_items_project_column ON roadmap_items(project_id, "column", position);
CREATE INDEX idx_roadmap_items_feedback ON roadmap_items(feedback_id);

-- Roadmap votes
CREATE TABLE IF NOT EXISTS roadmap_votes (
  id UUID PRIMARY KEY,
  roadmap_item_id UUID NOT NULL REFERENCES roadmap_items(id) ON DELETE CASCADE,
  user_identifier TEXT NOT NULL,
  vote SMALLINT NOT NULL CHECK (vote IN (1, -1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (roadmap_item_id, user_identifier)
);

CREATE INDEX idx_roadmap_votes_item ON roadmap_votes(roadmap_item_id);
```

**Step 2: Check existing migration numbering**

Look at `packages/db/migrations/` for the correct next number. If 007 is taken, adjust.

**Step 3: Commit**

```bash
git add packages/db/migrations/
git commit -m "feat: add roadmap database migration"
```

---

### Task 4: Add roadmap API routes

**Files:**
- Create: `workers/api/src/routes/roadmap.ts`
- Modify: `workers/api/src/index.ts`

**Step 1: Create the route file**

```ts
import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireSession } from '../middleware/auth';
import { getDb } from '../db';
import type { CreateRoadmapItemRequest, UpdateRoadmapItemRequest, ReorderRoadmapRequest, RoadmapColumn } from '@saas-maker/shared-types';

const roadmap = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const VALID_COLUMNS: RoadmapColumn[] = ['backlog', 'planned', 'in_progress', 'done'];

// Public: list public roadmap items by project slug
roadmap.get('/public/:slug', async (c) => {
  const slug = c.req.param('slug');
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectBySlug(slug);
  if (!project) return c.json({ error: 'Project not found' }, 404);

  const items = await db.listRoadmapItems(project.id, true);
  return c.json({ data: items, project: { name: project.name, slug: project.slug } });
});

// Public: vote on a roadmap item
roadmap.post('/public/:slug/:id/vote', async (c) => {
  const slug = c.req.param('slug');
  const itemId = c.req.param('id');
  const body = await c.req.json();

  if (!body.user_identifier?.trim()) return c.json({ error: 'user_identifier is required' }, 400);
  if (![1, -1].includes(body.vote)) return c.json({ error: 'vote must be 1 or -1' }, 400);

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectBySlug(slug);
  if (!project) return c.json({ error: 'Project not found' }, 404);

  const item = await db.getRoadmapItemById(itemId);
  if (!item || item.project_id !== project.id || !item.public) {
    return c.json({ error: 'Item not found' }, 404);
  }

  await db.setRoadmapVote({
    id: crypto.randomUUID(),
    roadmap_item_id: itemId,
    user_identifier: body.user_identifier.trim(),
    vote: body.vote,
  });

  return c.json({ ok: true });
});

// Public: remove vote
roadmap.delete('/public/:slug/:id/vote', async (c) => {
  const slug = c.req.param('slug');
  const itemId = c.req.param('id');
  const userIdentifier = c.req.query('user_identifier');

  if (!userIdentifier) return c.json({ error: 'user_identifier query param is required' }, 400);

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectBySlug(slug);
  if (!project) return c.json({ error: 'Project not found' }, 404);

  await db.removeRoadmapVote(itemId, userIdentifier);
  return c.json({ ok: true });
});

// --- Dashboard routes (session auth) ---

// List all roadmap items (including private)
roadmap.get('/dashboard/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const items = await db.listRoadmapItems(projectId, false);
  return c.json({ data: items });
});

// Create roadmap item
roadmap.post('/dashboard/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const body = (await c.req.json()) as CreateRoadmapItemRequest;
  if (!body.title?.trim()) return c.json({ error: 'Title is required' }, 400);

  const column = body.column || 'backlog';
  if (!VALID_COLUMNS.includes(column)) return c.json({ error: 'Invalid column' }, 400);

  const position = await db.getNextRoadmapPosition(projectId, column);

  const item = await db.createRoadmapItem({
    id: crypto.randomUUID(),
    project_id: projectId,
    feedback_id: null,
    title: body.title.trim(),
    description: body.description?.trim() || null,
    column,
    position,
    public: body.public ?? true,
  });

  return c.json(item, 201);
});

// Promote feedback to roadmap item
roadmap.post('/dashboard/:projectId/from-feedback/:feedbackId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const feedbackId = c.req.param('feedbackId');

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const feedback = await db.getFeedbackById(feedbackId);
  if (!feedback || feedback.project_id !== projectId) return c.json({ error: 'Feedback not found' }, 404);

  const position = await db.getNextRoadmapPosition(projectId, 'planned');

  const item = await db.createRoadmapItem({
    id: crypto.randomUUID(),
    project_id: projectId,
    feedback_id: feedbackId,
    title: feedback.title,
    description: feedback.description || null,
    column: 'planned',
    position,
    public: true,
  });

  // Mark feedback as on_roadmap
  await db.updateFeedbackStatus(feedbackId, 'on_roadmap');

  return c.json(item, 201);
});

// Update roadmap item
roadmap.patch('/dashboard/:projectId/:id', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const itemId = c.req.param('id');

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const existing = await db.getRoadmapItemById(itemId);
  if (!existing || existing.project_id !== projectId) return c.json({ error: 'Not found' }, 404);

  const body = (await c.req.json()) as UpdateRoadmapItemRequest;

  if (body.column && !VALID_COLUMNS.includes(body.column)) {
    return c.json({ error: 'Invalid column' }, 400);
  }

  const updated = await db.updateRoadmapItem(itemId, {
    title: body.title?.trim(),
    description: body.description?.trim(),
    column: body.column,
    position: body.position,
    public: body.public,
  });

  return c.json(updated);
});

// Delete roadmap item
roadmap.delete('/dashboard/:projectId/:id', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const itemId = c.req.param('id');

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const existing = await db.getRoadmapItemById(itemId);
  if (!existing || existing.project_id !== projectId) return c.json({ error: 'Not found' }, 404);

  await db.deleteRoadmapItem(itemId);
  return c.json({ ok: true });
});

// Batch reorder after drag-and-drop
roadmap.post('/dashboard/:projectId/reorder', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const body = (await c.req.json()) as ReorderRoadmapRequest;
  if (!Array.isArray(body.items)) return c.json({ error: 'items array is required' }, 400);

  for (const item of body.items) {
    if (!item.id || !item.column || typeof item.position !== 'number') {
      return c.json({ error: 'Each item needs id, column, position' }, 400);
    }
    if (!VALID_COLUMNS.includes(item.column as any)) {
      return c.json({ error: `Invalid column: ${item.column}` }, 400);
    }
  }

  await db.batchUpdateRoadmapPositions(body.items);
  return c.json({ ok: true });
});

export { roadmap };
```

**Step 2: Register route in workers/api/src/index.ts**

Add import:
```ts
import { roadmap } from './routes/roadmap';
```

Add route (after `app.route('/v1/ai', aiGateway);`):
```ts
app.route('/v1/roadmap', roadmap);
```

**Step 3: Commit**

```bash
git add workers/api/src/routes/roadmap.ts workers/api/src/index.ts
git commit -m "feat: add roadmap API routes"
```

---

### Task 5: Add `on_roadmap` feedback status

**Files:**
- Modify: `packages/shared-types/src/index.ts`
- Modify: `workers/api/src/routes/feedback.ts`
- Modify: `apps/dashboard/src/components/feedback-table.tsx`

**Step 1: Update shared types**

In `packages/shared-types/src/index.ts`, update:

```ts
export type FeedbackStatus = 'new' | 'in_progress' | 'done' | 'dismissed' | 'on_roadmap';
```

**Step 2: Update feedback routes**

In `workers/api/src/routes/feedback.ts`, update the valid status arrays:

```ts
const VALID_DEFAULT_STATUSES: FeedbackStatus[] = ['new', 'in_progress', 'done', 'dismissed', 'on_roadmap'];
const VALID_FILTER_STATUSES: AnyFeedbackStatus[] = ['new', 'in_progress', 'done', 'dismissed', 'planned', 'shipped', 'cancelled', 'on_roadmap'];
```

**Step 3: Update feedback table UI**

In `apps/dashboard/src/components/feedback-table.tsx`, add to `STATUS_STYLES`:

```ts
  on_roadmap: { label: "On Roadmap", variant: "default" },
```

**Step 4: Commit**

```bash
git add packages/shared-types/src/index.ts workers/api/src/routes/feedback.ts apps/dashboard/src/components/feedback-table.tsx
git commit -m "feat: add on_roadmap feedback status"
```

---

### Task 6: Install @dnd-kit and build owner Kanban board page

**Files:**
- Create: `apps/dashboard/src/app/projects/[slug]/roadmap/page.tsx`
- Create: `apps/dashboard/src/app/projects/[slug]/roadmap/roadmap-board.tsx`
- Create: `apps/dashboard/src/app/projects/[slug]/roadmap/kanban-column.tsx`
- Create: `apps/dashboard/src/app/projects/[slug]/roadmap/kanban-card.tsx`
- Create: `apps/dashboard/src/app/projects/[slug]/roadmap/create-roadmap-item-dialog.tsx`
- Modify: `apps/dashboard/src/components/sidebar-nav.tsx`

**Step 1: Install @dnd-kit**

```bash
cd apps/dashboard && pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Step 2: Add Roadmap to sidebar**

In `apps/dashboard/src/components/sidebar-nav.tsx`, add to `projectNavItems` array between Feedback and Testimonials. Import `Map` from lucide-react:

```ts
import { ..., Map } from "lucide-react";

const projectNavItems = [
  { label: "Feedback", href: "", icon: MessageSquare },
  { label: "Roadmap", href: "/roadmap", icon: Map },
  { label: "Testimonials", href: "/testimonials", icon: Star },
  // ... rest
];
```

**Step 3: Create kanban-card.tsx**

```tsx
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, MessageSquare } from "lucide-react";
import type { RoadmapItemRecord } from "@saas-maker/shared-types";

interface KanbanCardProps {
  item: RoadmapItemRecord;
  onClick: () => void;
}

export function KanbanCard({ item, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-3 cursor-grab active:cursor-grabbing hover:border-foreground/20 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium leading-tight">{item.title}</h4>
        <div className="flex items-center gap-1 shrink-0">
          {!item.public && <Lock className="h-3 w-3 text-muted-foreground" />}
          {item.feedback_id && <MessageSquare className="h-3 w-3 text-muted-foreground" />}
        </div>
      </div>
      {item.description && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.description}</p>
      )}
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>▲ {item.upvote_count}</span>
        {item.downvote_count > 0 && <span>▼ {item.downvote_count}</span>}
      </div>
    </Card>
  );
}
```

**Step 4: Create kanban-column.tsx**

```tsx
"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { KanbanCard } from "./kanban-card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { RoadmapItemRecord, RoadmapColumn } from "@saas-maker/shared-types";

const COLUMN_LABELS: Record<RoadmapColumn, string> = {
  backlog: "Backlog",
  planned: "Planned",
  in_progress: "In Progress",
  done: "Done",
};

interface KanbanColumnProps {
  column: RoadmapColumn;
  items: RoadmapItemRecord[];
  onAddClick: () => void;
  onCardClick: (item: RoadmapItemRecord) => void;
}

export function KanbanColumn({ column, items, onAddClick, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-lg border bg-muted/30 p-3 min-h-[200px] ${
        isOver ? "border-foreground/30 bg-muted/50" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{COLUMN_LABELS[column]}</h3>
          <Badge variant="secondary" className="text-xs">{items.length}</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAddClick}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 flex-1">
          {items.map((item) => (
            <KanbanCard key={item.id} item={item} onClick={() => onCardClick(item)} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
```

**Step 5: Create create-roadmap-item-dialog.tsx**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiFetchClient, getClientToken } from "@/lib/api-client";
import type { RoadmapColumn, RoadmapItemRecord } from "@saas-maker/shared-types";

interface Props {
  projectId: string;
  column: RoadmapColumn;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (item: RoadmapItemRecord) => void;
}

export function CreateRoadmapItemDialog({ projectId, column, open, onOpenChange, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  function resetForm() {
    setTitle("");
    setDescription("");
    setIsPublic(true);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = await getClientToken();
      const item = await apiFetchClient<RoadmapItemRecord>(
        `/v1/roadmap/dashboard/${projectId}`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || undefined,
            column,
            public: isPublic,
          }),
        }
      );
      onCreated(item);
      onOpenChange(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create item");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
            <DialogDescription>Create a new roadmap item.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="rm-title">Title *</Label>
              <Input id="rm-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rm-desc">Description</Label>
              <Textarea id="rm-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="rm-public" checked={isPublic} onCheckedChange={setIsPublic} />
              <Label htmlFor="rm-public">Public</Label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !title.trim()}>
              {loading ? "Creating..." : "Add Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 6: Create roadmap-board.tsx (main Kanban component with DnD)**

```tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import { CreateRoadmapItemDialog } from "./create-roadmap-item-dialog";
import { apiFetchClient, getClientToken } from "@/lib/api-client";
import type { RoadmapItemRecord, RoadmapColumn } from "@saas-maker/shared-types";

const COLUMNS: RoadmapColumn[] = ["backlog", "planned", "in_progress", "done"];

interface Props {
  projectId: string;
  initialItems: RoadmapItemRecord[];
}

export function RoadmapBoard({ projectId, initialItems }: Props) {
  const [items, setItems] = useState<RoadmapItemRecord[]>(initialItems);
  const [activeItem, setActiveItem] = useState<RoadmapItemRecord | null>(null);
  const [addColumn, setAddColumn] = useState<RoadmapColumn | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function getColumnItems(col: RoadmapColumn) {
    return items.filter((i) => i.column === col).sort((a, b) => a.position - b.position);
  }

  function findColumnForItem(id: string): RoadmapColumn | null {
    const item = items.find((i) => i.id === id);
    return item ? item.column : null;
  }

  function handleDragStart(event: DragStartEvent) {
    const item = items.find((i) => i.id === event.active.id);
    if (item) setActiveItem(item);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeCol = findColumnForItem(activeId);
    // over can be a column ID or another card ID
    const overCol = COLUMNS.includes(overId as RoadmapColumn)
      ? (overId as RoadmapColumn)
      : findColumnForItem(overId);

    if (!activeCol || !overCol || activeCol === overCol) return;

    // Move item to new column
    setItems((prev) =>
      prev.map((item) =>
        item.id === activeId ? { ...item, column: overCol } : item
      )
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveItem(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeCol = findColumnForItem(activeId);
    if (!activeCol) return;

    const colItems = getColumnItems(activeCol);
    const activeIndex = colItems.findIndex((i) => i.id === activeId);

    let overIndex: number;
    if (COLUMNS.includes(overId as RoadmapColumn)) {
      // Dropped on empty column
      overIndex = colItems.length - 1;
    } else {
      overIndex = colItems.findIndex((i) => i.id === overId);
    }

    if (activeIndex !== overIndex && overIndex >= 0) {
      const reordered = arrayMove(colItems, activeIndex, overIndex);
      setItems((prev) => {
        const others = prev.filter((i) => i.column !== activeCol);
        return [...others, ...reordered.map((item, i) => ({ ...item, position: i }))];
      });
    }

    // Persist reorder
    const finalColItems = getColumnItems(activeCol);
    persistReorder(finalColItems.map((item, i) => ({ id: item.id, column: activeCol, position: i })));
  }

  async function persistReorder(updates: { id: string; column: RoadmapColumn; position: number }[]) {
    try {
      const token = await getClientToken();
      await apiFetchClient(`/v1/roadmap/dashboard/${projectId}/reorder`, token, {
        method: "POST",
        body: JSON.stringify({ items: updates }),
      });
    } catch {
      // Silently fail — next refresh will correct
    }
  }

  function handleItemCreated(item: RoadmapItemRecord) {
    setItems((prev) => [...prev, item]);
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col}
              column={col}
              items={getColumnItems(col)}
              onAddClick={() => setAddColumn(col)}
              onCardClick={() => {}}
            />
          ))}
        </div>
        <DragOverlay>
          {activeItem ? <KanbanCard item={activeItem} onClick={() => {}} /> : null}
        </DragOverlay>
      </DndContext>

      {addColumn && (
        <CreateRoadmapItemDialog
          projectId={projectId}
          column={addColumn}
          open={!!addColumn}
          onOpenChange={(open) => { if (!open) setAddColumn(null); }}
          onCreated={handleItemCreated}
        />
      )}
    </>
  );
}
```

**Step 7: Create the page.tsx**

```tsx
import { PageHeader } from "@/components/page-header";
import { CopyButton } from "@/components/copy-button";
import { ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getAuthenticatedProject } from "../get-project";
import { RoadmapBoard } from "./roadmap-board";
import type { RoadmapItemRecord } from "@saas-maker/shared-types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default async function RoadmapPage({ params }: Props) {
  const { slug } = await params;
  const { project, token } = await getAuthenticatedProject(slug);

  let items: RoadmapItemRecord[] = [];

  try {
    const res = await apiFetch(
      `/v1/roadmap/dashboard/${project.id}`,
      {},
      token
    );
    items = res.data ?? [];
  } catch {
    // Fetch failed
  }

  const publicUrl = `${SITE_URL}/roadmap/${project.slug}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Roadmap" description="Manage your project roadmap" />

      <div className="flex items-center gap-2 rounded-md border px-3 py-2">
        <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground">Public roadmap:</span>
        <code className="flex-1 text-sm font-mono truncate">{publicUrl}</code>
        <CopyButton value={publicUrl} />
      </div>

      <RoadmapBoard projectId={project.id} initialItems={items} />
    </div>
  );
}
```

**Step 8: Commit**

```bash
git add apps/dashboard/src/app/projects/\[slug\]/roadmap/ apps/dashboard/src/components/sidebar-nav.tsx
git commit -m "feat: add owner Kanban roadmap board with drag-and-drop"
```

---

### Task 7: Add "Move to Roadmap" action to feedback page

**Files:**
- Modify: `apps/dashboard/src/app/projects/[slug]/inbox-content.tsx`
- Modify: `apps/dashboard/src/components/feedback-table.tsx`
- Modify: `apps/dashboard/src/components/feedback-detail.tsx`

**Step 1: Add onMoveToRoadmap to feedback-table.tsx**

Add a new prop `onMoveToRoadmap` to `FeedbackTableProps`:

```ts
interface FeedbackTableProps {
  feedback: FeedbackRecord[];
  onStatusChange?: (item: FeedbackRecord, status: AnyFeedbackStatus) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onMoveToRoadmap?: (item: FeedbackRecord) => Promise<void>;
}
```

Pass it through to `FeedbackDetail`.

**Step 2: Add "Move to Roadmap" button to feedback-detail.tsx**

Read the file first. Add a button that calls `onMoveToRoadmap` for items that are not already `on_roadmap`. Show the button in the detail panel alongside the existing status/delete actions. Use a `Map` icon from lucide-react.

**Step 3: Wire up in inbox-content.tsx**

Add a `handleMoveToRoadmap` function that calls:

```ts
async function handleMoveToRoadmap(item: FeedbackRecord) {
  const token = await getToken();
  await apiFetchClient(
    `/v1/roadmap/dashboard/${projectId}/from-feedback/${item.id}`,
    token,
    { method: "POST" }
  );
  // Update local state — mark feedback as on_roadmap
  setFeedback((prev) =>
    prev.map((f) => (f.id === item.id ? { ...f, status: "on_roadmap" as AnyFeedbackStatus } : f))
  );
}
```

Note: `inbox-content.tsx` currently uses `slug` not `projectId`. You'll need to resolve the project ID. The simplest approach is to pass `projectId` as a prop from the parent `page.tsx`.

**Step 4: Update the inbox page.tsx to pass projectId**

In `apps/dashboard/src/app/projects/[slug]/page.tsx`, change:
```tsx
<InboxContent slug={project.slug} />
```
to:
```tsx
<InboxContent slug={project.slug} projectId={project.id} />
```

And update `InboxContentProps` to include `projectId: string`.

**Step 5: Commit**

```bash
git add apps/dashboard/src/app/projects/\[slug\]/page.tsx apps/dashboard/src/app/projects/\[slug\]/inbox-content.tsx apps/dashboard/src/components/feedback-table.tsx apps/dashboard/src/components/feedback-detail.tsx
git commit -m "feat: add Move to Roadmap action on feedback items"
```

---

### Task 8: Build public roadmap page

**Files:**
- Create: `apps/dashboard/src/app/roadmap/[slug]/page.tsx`
- Create: `apps/dashboard/src/app/roadmap/[slug]/public-roadmap.tsx`

**Step 1: Create the public roadmap client component**

`apps/dashboard/src/app/roadmap/[slug]/public-roadmap.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThumbsUp } from "lucide-react";
import type { RoadmapItemRecord, RoadmapColumn } from "@saas-maker/shared-types";

const COLUMNS: RoadmapColumn[] = ["backlog", "planned", "in_progress", "done"];
const COLUMN_LABELS: Record<RoadmapColumn, string> = {
  backlog: "Backlog",
  planned: "Planned",
  in_progress: "In Progress",
  done: "Done",
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

interface Props {
  slug: string;
  initialItems: RoadmapItemRecord[];
}

export function PublicRoadmap({ slug, initialItems }: Props) {
  const [items, setItems] = useState(initialItems);

  function getColumnItems(col: RoadmapColumn) {
    return items.filter((i) => i.column === col).sort((a, b) => a.position - b.position);
  }

  async function handleUpvote(itemId: string) {
    // Use a simple fingerprint as user_identifier (localStorage-based)
    let userId = localStorage.getItem("roadmap_user_id");
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem("roadmap_user_id", userId);
    }

    try {
      await fetch(`${API_BASE}/v1/roadmap/public/${slug}/${itemId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_identifier: userId, vote: 1 }),
      });
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, upvote_count: i.upvote_count + 1 } : i))
      );
    } catch {
      // Silently fail
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {COLUMNS.map((col) => {
        const colItems = getColumnItems(col);
        return (
          <div key={col} className="flex flex-col rounded-lg border bg-muted/30 p-3 min-h-[200px]">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold">{COLUMN_LABELS[col]}</h3>
              <Badge variant="secondary" className="text-xs">{colItems.length}</Badge>
            </div>
            <div className="flex flex-col gap-2 flex-1">
              {colItems.map((item) => (
                <Card key={item.id} className="p-3">
                  <h4 className="text-sm font-medium">{item.title}</h4>
                  {item.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{item.description}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleUpvote(item.id)}
                    >
                      <ThumbsUp className="h-3 w-3 mr-1" />
                      {item.upvote_count}
                    </Button>
                  </div>
                </Card>
              ))}
              {colItems.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No items</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Create the page.tsx**

`apps/dashboard/src/app/roadmap/[slug]/page.tsx`:

```tsx
import { PublicRoadmap } from "./public-roadmap";
import type { RoadmapItemRecord } from "@saas-maker/shared-types";

export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PublicRoadmapPage({ params }: Props) {
  const { slug } = await params;

  let items: RoadmapItemRecord[] = [];
  let projectName = "";

  try {
    const res = await fetch(`${API_BASE}/v1/roadmap/public/${slug}`);
    if (res.ok) {
      const data = await res.json();
      items = data.data ?? [];
      projectName = data.project?.name ?? slug;
    }
  } catch {
    // Fetch failed
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-2xl font-bold">{projectName} Roadmap</h1>
          <p className="text-muted-foreground">See what we're working on</p>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <PublicRoadmap slug={slug} initialItems={items} />
      </main>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/dashboard/src/app/roadmap/
git commit -m "feat: add public roadmap page with voting"
```

---

### Task 9: Run migration and verify

**Step 1: Run the migration against the database**

Check how existing migrations were run (look for a migration script or manual psql execution pattern).

**Step 2: Build dashboard**

```bash
pnpm --filter dashboard build
```

**Step 3: Typecheck API worker**

```bash
cd workers/api && pnpm tsc --noEmit
```

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: verify build and typecheck pass"
```
