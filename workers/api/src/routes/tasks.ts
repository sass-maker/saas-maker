import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireSession } from '../middleware/auth';
import { getDb } from '../db';
import { capture } from '../lib/telemetry';

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

// GET /v1/tasks/:id — get one task
tasks.get('/:id', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const id = c.req.param('id');
  const db = getDb(c.env.DB);
  const task = await db.getTask(id, userId);
  if (!task) return c.json({ error: 'Task not found' }, 404);
  return c.json({ data: task });
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
const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
const COMMENT_AUTHOR_TYPES = ['user', 'agent'] as const;

function normalizeBlockedDeployment(input: {
  blocked_on_user?: boolean;
  deployment_status?: typeof DEPLOYMENT_STATUSES[number];
}) {
  if (input.blocked_on_user === true) {
    input.deployment_status = 'none';
  }
  if (input.deployment_status && input.deployment_status !== 'none') {
    input.blocked_on_user = false;
  }
  return input;
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
    branch_name?: unknown;
    pr_url?: unknown;
    pr_status?: unknown;
    commit_sha?: unknown;
    deployment_url?: unknown;
    deployment_status?: unknown;
    blocked_on_user?: unknown;
  };
  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return c.json({ error: 'title is required' }, 400);
  }
  const prStatus = enumValue(body.pr_status, PR_STATUSES);
  const deploymentStatus = enumValue(body.deployment_status, DEPLOYMENT_STATUSES);
  const state = normalizeBlockedDeployment({
    deployment_status: deploymentStatus,
    blocked_on_user: body.blocked_on_user === true,
  });
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
    deployment_status: state.deployment_status,
    blocked_on_user: state.blocked_on_user,
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
      blocked_on_user: task.blocked_on_user,
    },
  });
  capture({ distinctId: userId, event: 'task_created', properties: { task_id: task.id, priority: task.priority ?? undefined, task_type: task.task_type ?? undefined, size: task.size ?? undefined, project_id: body.project_slug ?? undefined } });
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
    blocked_on_user: boolean;
  }>;
  const db = getDb(c.env.DB);
  const { dependencies: rawDependencies, ...rest } = body;
  const state = normalizeBlockedDeployment({
    deployment_status: enumValue(body.deployment_status, DEPLOYMENT_STATUSES),
    blocked_on_user: body.blocked_on_user,
  });
  const updates: Record<string, unknown> = {
    ...rest,
    status: enumValue(body.status, TASK_STATUSES),
    branch_name: optionalString(body.branch_name),
    pr_url: optionalString(body.pr_url),
    pr_status: enumValue(body.pr_status, PR_STATUSES),
    commit_sha: optionalString(body.commit_sha),
    deployment_url: optionalString(body.deployment_url),
    deployment_status: state.deployment_status,
    blocked_on_user: state.blocked_on_user,
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
      blocked_on_user: updates.blocked_on_user,
    },
  });
  if (body.status) capture({ distinctId: userId, event: 'task_status_updated', properties: { task_id: id, status: body.status } });
  return c.json({ data: task });
});

// GET /v1/tasks/:id/comments — list comments for one task
tasks.get('/:id/comments', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const id = c.req.param('id');
  const db = getDb(c.env.DB);
  const data = await db.listTaskComments(userId, id);
  return c.json({ data });
});

// POST /v1/tasks/:id/comments — add a comment, optionally resolving a user blocker
tasks.post('/:id/comments', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const id = c.req.param('id');
  const body = await c.req.json() as {
    body?: unknown;
    author_type?: unknown;
    resolves_blocker?: unknown;
    marks_done?: unknown;
    sync_to_description?: unknown;
  };
  if (typeof body.body !== 'string' || !body.body.trim()) {
    return c.json({ error: 'body is required' }, 400);
  }

  const db = getDb(c.env.DB);
  const comment = await db.createTaskComment(userId, id, {
    body: body.body.trim(),
    author_type: enumValue(body.author_type, COMMENT_AUTHOR_TYPES),
    resolves_blocker: body.resolves_blocker === true,
    marks_done: body.marks_done === true,
    sync_to_description: body.sync_to_description === true,
  });
  if (!comment) return c.json({ error: 'Task not found' }, 404);
  const task = comment.resolves_blocker || comment.marks_done || body.sync_to_description === true ? await db.getTask(id, userId) : null;

  await recordAudit(db, userId, {
    task_id: id,
    action: comment.marks_done ? 'task_comment_marked_done' : comment.resolves_blocker ? 'task_comment_resolved_blocker' : 'task_comment_created',
    actor_source: 'api',
    metadata: {
      author_type: comment.author_type,
      resolves_blocker: comment.resolves_blocker,
      marks_done: comment.marks_done,
      sync_to_description: body.sync_to_description === true,
    },
  });
  return c.json({ data: comment, task }, 201);
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
