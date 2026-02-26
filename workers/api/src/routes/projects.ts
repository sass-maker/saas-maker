import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireSession } from '../middleware/auth';
import { getDb } from '../db';

const projects = new Hono<{ Bindings: Bindings; Variables: Variables }>();
projects.use('*', requireSession);

function generateApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return (
    'pk_' +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

projects.get('/', async (c) => {
  const userId = c.get('userId')!;
  const db = getDb(c.env.DATABASE_URL);
  const data = await db.listProjectsByOwner(userId);
  return c.json({ data });
});

projects.post('/', async (c) => {
  const userId = c.get('userId')!;
  const body = (await c.req.json()) as { name: string };
  if (!body.name?.trim()) return c.json({ error: 'Project name is required' }, 400);

  const db = getDb(c.env.DATABASE_URL);
  const project = await db.createProject({
    id: crypto.randomUUID(),
    name: body.name.trim(),
    slug: slugify(body.name) + '-' + Date.now().toString(36),
    api_key: generateApiKey(),
    owner_id: userId,
  });

  return c.json(project, 201);
});

projects.patch('/:id', async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('id');
  const body = (await c.req.json()) as { name?: string };

  const db = getDb(c.env.DATABASE_URL);

  // Verify ownership
  const existing = await db.getProjectById(projectId);
  if (!existing) return c.json({ error: 'Project not found' }, 404);
  if (existing.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const updated = await db.updateProject(projectId, { name: body.name });
  return c.json(updated);
});

projects.delete('/:id', async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('id');

  const db = getDb(c.env.DATABASE_URL);

  // Verify ownership
  const existing = await db.getProjectById(projectId);
  if (!existing) return c.json({ error: 'Project not found' }, 404);
  if (existing.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  await db.deleteProject(projectId);
  return c.json({ ok: true });
});

export { projects };
