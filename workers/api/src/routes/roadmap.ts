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
