import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireSession } from '../middleware/auth';
import { getDb } from '../db';

const tasks = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// GET /v1/tasks — list all tasks for user (optional ?status= filter)
tasks.get('/', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const status = c.req.query('status');
  const db = getDb(c.env.DB);
  const data = await db.listTasks(userId, status);
  return c.json({ data });
});

// POST /v1/tasks — create task
tasks.post('/', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const body = await c.req.json() as {
    title?: string;
    description?: string;
    project_slug?: string;
    priority?: string;
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
  });
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
  }>;
  const db = getDb(c.env.DB);
  const task = await db.updateTask(id, userId, body);
  if (!task) return c.json({ error: 'Task not found' }, 404);
  return c.json({ data: task });
});

// DELETE /v1/tasks/:id — delete task
tasks.delete('/:id', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const id = c.req.param('id');
  const db = getDb(c.env.DB);
  const ok = await db.deleteTask(id, userId);
  if (!ok) return c.json({ error: 'Task not found' }, 404);
  return c.json({ ok: true });
});

export { tasks };
