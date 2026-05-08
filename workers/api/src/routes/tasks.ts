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

function optionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : undefined;
}

const PR_STATUSES = ['none', 'draft', 'open', 'merged', 'closed'] as const;
const DEPLOYMENT_STATUSES = ['none', 'pending', 'success', 'failed'] as const;

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
    branch_name?: unknown;
    pr_url?: unknown;
    pr_status?: unknown;
    commit_sha?: unknown;
    deployment_url?: unknown;
    deployment_status?: unknown;
  };
  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return c.json({ error: 'title is required' }, 400);
  }
  const prStatus = enumValue(body.pr_status, PR_STATUSES);
  const deploymentStatus = enumValue(body.deployment_status, DEPLOYMENT_STATUSES);
  const db = getDb(c.env.DB);
  const task = await db.createTask(userId, {
    title: body.title.trim(),
    description: body.description,
    project_slug: body.project_slug,
    priority: body.priority,
    task_type: body.task_type,
    size: body.size,
    dependencies: normalizeDependencies(body.dependencies),
    branch_name: optionalString(body.branch_name),
    pr_url: optionalString(body.pr_url),
    pr_status: prStatus,
    commit_sha: optionalString(body.commit_sha),
    deployment_url: optionalString(body.deployment_url),
    deployment_status: deploymentStatus,
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
      branch_name: task.branch_name,
      pr_url: task.pr_url,
      pr_status: task.pr_status,
      commit_sha: task.commit_sha,
      deployment_url: task.deployment_url,
      deployment_status: task.deployment_status,
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
    branch_name: unknown;
    pr_url: unknown;
    pr_status: unknown;
    commit_sha: unknown;
    deployment_url: unknown;
    deployment_status: unknown;
  }>;
  const db = getDb(c.env.DB);
  const { dependencies: rawDependencies, ...rest } = body;
  const updates: Record<string, unknown> = {
    ...rest,
    branch_name: optionalString(body.branch_name),
    pr_url: optionalString(body.pr_url),
    pr_status: enumValue(body.pr_status, PR_STATUSES),
    commit_sha: optionalString(body.commit_sha),
    deployment_url: optionalString(body.deployment_url),
    deployment_status: enumValue(body.deployment_status, DEPLOYMENT_STATUSES),
  };
  for (const key of Object.keys(updates)) {
    if (updates[key] === undefined) delete updates[key];
  }
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
      branch_name: updates.branch_name,
      pr_url: updates.pr_url,
      pr_status: updates.pr_status,
      commit_sha: updates.commit_sha,
      deployment_url: updates.deployment_url,
      deployment_status: updates.deployment_status,
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
