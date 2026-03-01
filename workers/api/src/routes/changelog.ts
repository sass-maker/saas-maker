import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey, requireSession } from '../middleware/auth';
import { getDb } from '../db';
import type { CreateChangelogEntryRequest, UpdateChangelogEntryRequest } from '@saas-maker/shared-types';

const changelog = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const PAGE_SIZE = 50;
const VALID_TYPES = ['feature', 'improvement', 'fix', 'breaking'];

// Public: list published changelog entries (API key — for widget)
changelog.get('/', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const data = await db.listPublishedChangelog(projectId, limit);
  return c.json({ data });
});

// Dashboard: list all changelog entries (session auth)
changelog.get('/dashboard/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const page = parseInt(c.req.query('page') || '1', 10);

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const result = await db.listChangelogEntries(projectId, page, PAGE_SIZE);
  const stats = await db.getChangelogStats(projectId);
  return c.json({ data: result.data, total: result.total, page, limit: PAGE_SIZE, stats });
});

// Dashboard: create changelog entry (session auth)
changelog.post('/dashboard/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const body = (await c.req.json()) as CreateChangelogEntryRequest;

  if (!body.title?.trim()) return c.json({ error: 'Title is required' }, 400);
  if (!body.content?.trim()) return c.json({ error: 'Content is required' }, 400);
  if (body.type && !VALID_TYPES.includes(body.type)) {
    return c.json({ error: 'Invalid type. Must be one of: feature, improvement, fix, breaking' }, 400);
  }

  const published = body.published ?? false;
  const entry = await db.createChangelogEntry({
    id: crypto.randomUUID(),
    project_id: projectId,
    title: body.title.trim(),
    content: body.content.trim(),
    version: body.version?.trim() || null,
    type: body.type || 'improvement',
    published,
    published_at: published ? new Date().toISOString() : null,
  });

  return c.json(entry, 201);
});

// Dashboard: update changelog entry (session auth)
changelog.patch('/dashboard/:projectId/:id', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const entryId = c.req.param('id');

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const body = (await c.req.json()) as UpdateChangelogEntryRequest;

  if (body.type && !VALID_TYPES.includes(body.type)) {
    return c.json({ error: 'Invalid type. Must be one of: feature, improvement, fix, breaking' }, 400);
  }

  const updated = await db.updateChangelogEntry(entryId, {
    title: body.title?.trim(),
    content: body.content?.trim(),
    version: body.version?.trim(),
    type: body.type,
    published: body.published,
  });

  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
});

// Dashboard: delete changelog entry (session auth)
changelog.delete('/dashboard/:projectId/:id', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const entryId = c.req.param('id');

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const deleted = await db.deleteChangelogEntry(entryId);
  if (!deleted) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

export { changelog };
