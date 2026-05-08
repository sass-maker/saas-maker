import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireSession } from '../middleware/auth';
import { getDb } from '../db';
import { capture } from '@saas-maker/ops';

const tasks = new Hono<{ Bindings: Bindings; Variables: Variables }>();

async function recordAudit(db: ReturnType<typeof getDb>, ownerId: string, input: {
  task_id?: string | null;
  action: string;
  actor_source?: string;
  agent_profile?: string | null;
  project_slug?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await db.createSymphonyAuditEvent(ownerId, input);
  } catch (error) {
    console.warn('Failed to record Symphony audit event', error);
  }
}

// GET /v1/tasks — list all tasks for user (optional ?status= and ?project_slug= filters)
tasks.get('/', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const status = c.req.query('status');
  const projectSlug = c.req.query('project_slug');
  const db = getDb(c.env.DB);
  const data = await db.listTasks(userId, status, projectSlug);
  return c.json({ data });
});

function normalizeDependencies(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry === 'string' && entry.trim()) seen.add(entry.trim());
  }
  return Array.from(seen);
}

// POST /v1/tasks — create task
tasks.post('/', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const body = await c.req.json() as {
    title?: string;
    description?: string;
    project_slug?: string;
    priority?: string;
    task_type?: string;
    size?: string;
    dependencies?: unknown;
  };
  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return c.json({ error: 'title is required' }, 400);
  }
  const db = getDb(c.env.DB);
  const task = await db.createTask(userId, {
    title: body.title.trim(),
    description: body.description,
    project_slug: body.project_slug,
    priority: body.priority,
    task_type: body.task_type,
    size: body.size,
    dependencies: normalizeDependencies(body.dependencies),
  });
  await recordAudit(db, userId, {
    task_id: task.id,
    action: 'task_created',
    actor_source: 'api',
    project_slug: task.project_slug,
    metadata: {
      title: task.title,
      priority: task.priority,
      task_type: task.task_type,
      size: task.size,
    },
  });
  capture({ distinctId: userId, event: 'task_created', properties: { task_id: task.id, priority: task.priority ?? undefined, task_type: task.task_type ?? undefined, size: task.size ?? undefined, project_slug: body.project_slug ?? undefined } });
  return c.json({ data: task }, 201);
});

// PATCH /v1/tasks/:id — update task fields
tasks.patch('/:id', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const id = c.req.param('id');
  const body = await c.req.json() as Partial<{
    title: string;
    description: string;
    status: string;
    priority: string;
    project_slug: string;
    task_type: string;
    size: string;
    dependencies: unknown;
  }>;
  const db = getDb(c.env.DB);
  const { dependencies: rawDependencies, ...rest } = body;
  const updates: Record<string, unknown> = { ...rest };
  if ('dependencies' in body) {
    updates.dependencies = normalizeDependencies(rawDependencies);
  }
  const task = await db.updateTask(id, userId, updates);
  if (!task) return c.json({ error: 'Task not found' }, 404);
  await recordAudit(db, userId, {
    task_id: task.id,
    action: body.status ? 'task_status_updated' : 'task_updated',
    actor_source: 'api',
    project_slug: task.project_slug,
    metadata: {
      changed_fields: Object.keys(body),
      status: body.status,
      priority: body.priority,
      task_type: body.task_type,
      size: body.size,
    },
  });
  if (body.status) capture({ distinctId: userId, event: 'task_status_updated', properties: { task_id: id, status: body.status } });
  return c.json({ data: task });
});

// DELETE /v1/tasks/:id — delete task
tasks.delete('/:id', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const id = c.req.param('id');
  const db = getDb(c.env.DB);
  const ok = await db.deleteTask(id, userId);
  if (!ok) return c.json({ error: 'Task not found' }, 404);
  await recordAudit(db, userId, {
    task_id: id,
    action: 'task_deleted',
    actor_source: 'api',
  });
  capture({ distinctId: userId, event: 'task_deleted', properties: { task_id: id } });
  return c.json({ ok: true });
});

export { tasks };
