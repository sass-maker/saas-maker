import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey, requireSession } from '../middleware/auth';
import { getDb } from '../db';
import type { CreateChangelogEntryRequest, UpdateChangelogEntryRequest } from '@saas-maker/contracts';

const changelog = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const PAGE_SIZE = 50;
const VALID_TYPES = ['feature', 'improvement', 'fix', 'breaking'];

async function resolveProjectForTaskSlug(db: ReturnType<typeof getDb>, userId: string, taskSlug: string) {
  const exactProject = await db.getProjectBySlug(taskSlug);
  if (exactProject?.owner_id === userId) return exactProject;

  const normalizeProjectKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedTaskSlug = normalizeProjectKey(taskSlug);
  const projects = await db.listProjectsByOwner(userId, 'all');
  return projects.find((project) => (
    project.slug === taskSlug ||
    project.slug.startsWith(`${taskSlug}-`) ||
    project.name.toLowerCase() === taskSlug.toLowerCase() ||
    normalizeProjectKey(project.slug) === normalizedTaskSlug ||
    normalizeProjectKey(project.slug).startsWith(normalizedTaskSlug) ||
    normalizeProjectKey(project.name) === normalizedTaskSlug
  )) ?? null;
}

// Public: list published changelog entries (API key — for widget)
changelog.get('/', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const db = getDb(c.env.DB);
  const data = await db.listPublishedChangelog(projectId, limit);
  return c.json({ data });
});

// Dashboard: list all changelog entries (session auth)
changelog.get('/dashboard/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const page = parseInt(c.req.query('page') || '1', 10);

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const [result, stats] = await Promise.all([
    db.listChangelogEntries(projectId, page, PAGE_SIZE),
    db.getChangelogStats(projectId),
  ]);
  return c.json({ data: result.data, total: result.total, page, limit: PAGE_SIZE, stats });
});

// Dashboard: create changelog entry (session auth)
changelog.post('/dashboard/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');

  const db = getDb(c.env.DB);
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
    source: body.source?.trim() || null,
    task_id: body.task_id?.trim() || null,
    agent: body.agent?.trim() || null,
    evidence: body.evidence?.trim() || null,
  });

  return c.json(entry, 201);
});

// Dashboard: update changelog entry (session auth)
changelog.patch('/dashboard/:projectId/:id', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const entryId = c.req.param('id');

  const db = getDb(c.env.DB);
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
    source: body.source?.trim(),
    task_id: body.task_id?.trim(),
    agent: body.agent?.trim(),
    evidence: body.evidence?.trim(),
  });

  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
});

// Dashboard: delete changelog entry (session auth)
changelog.delete('/dashboard/:projectId/:id', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const entryId = c.req.param('id');

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const deleted = await db.deleteChangelogEntry(entryId);
  if (!deleted) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

// Agent: auto-create a draft changelog entry from a completed task (session auth)
// POST /v1/changelog/from-task
// Body: { task_id, source?, agent?, evidence?, use_task_updated_at? }
// Returns { data: entry } on creation, { skipped: true, reason } when skipped.
changelog.post('/from-task', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const body = await c.req.json() as {
    task_id?: unknown;
    source?: unknown;
    agent?: unknown;
    evidence?: unknown;
    use_task_updated_at?: unknown;
  };

  if (typeof body.task_id !== 'string' || !body.task_id.trim()) {
    return c.json({ error: 'task_id is required' }, 400);
  }
  const taskId = body.task_id.trim();

  const db = getDb(c.env.DB);
  const task = await db.getTask(taskId, userId);
  if (!task) return c.json({ error: 'Task not found' }, 404);

  const PRODUCT_TYPES = new Set(['feature', 'bug']);
  if (!PRODUCT_TYPES.has(task.task_type)) {
    return c.json({ skipped: true, reason: 'infra_task' });
  }

  if (!task.project_slug) {
    return c.json({ skipped: true, reason: 'no_project' });
  }

  const project = await resolveProjectForTaskSlug(db, userId, task.project_slug);
  if (!project) {
    return c.json({ skipped: true, reason: 'no_project' });
  }

  const isDuplicate = await db.hasChangelogEntryForTask(taskId);
  if (isDuplicate) {
    return c.json({ skipped: true, reason: 'duplicate' });
  }

  const typeMap: Record<string, string> = { feature: 'feature', bug: 'fix' };
  const taskTimestamp = body.use_task_updated_at === true ? task.updated_at : null;
  const entry = await db.createChangelogEntry({
    id: crypto.randomUUID(),
    project_id: project.id,
    title: task.title,
    content: task.description || task.title,
    version: null,
    type: typeMap[task.task_type] || 'improvement',
    published: false,
    published_at: null,
    source: typeof body.source === 'string' && body.source.trim() ? body.source.trim() : 'symphony-cli',
    task_id: taskId,
    agent: typeof body.agent === 'string' && body.agent.trim() ? body.agent.trim() : null,
    evidence: typeof body.evidence === 'string' && body.evidence.trim() ? body.evidence.trim() : null,
    created_at: taskTimestamp,
    updated_at: taskTimestamp,
  });

  return c.json({ data: entry }, 201);
});

// Fleet: daily cross-project changelog (session auth)
// GET /v1/changelog/fleet/daily?date=YYYY-MM-DD  (defaults to today UTC)
// Date comparison uses UTC (date(created_at)). The Cockpit fleet page
// queries D1 directly with an IST offset (+5:30 hours) so entries created
// late at UTC night appear under the correct IST calendar day. When calling
// this endpoint from an IST context pass the IST date explicitly.
changelog.get('/fleet/daily', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const dateParam = c.req.query('date');
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : new Date().toISOString().slice(0, 10);

  const db = getDb(c.env.DB);
  const entries = await db.listFleetDailyChangelog(userId, date);

  const byProject: Record<string, typeof entries> = {};
  for (const entry of entries) {
    const key = entry.project_slug;
    if (!byProject[key]) byProject[key] = [];
    byProject[key].push(entry);
  }

  return c.json({ date, entries, by_project: byProject });
});

export { changelog };
