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
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const data = await db.listProjectsByOwner(userId);
  return c.json({ data });
});

projects.post('/', async (c) => {
  const userId = c.get('userId')!;
  const body = (await c.req.json()) as { name: string };
  if (!body.name?.trim()) return c.json({ error: 'Project name is required' }, 400);

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.createProject({
    id: crypto.randomUUID(),
    name: body.name.trim(),
    slug: slugify(body.name) + '-' + Date.now().toString(36),
    api_key: generateApiKey(),
    owner_id: userId,
  });

  return c.json(project, 201);
});

projects.get('/by-slug/:slug', async (c) => {
  const userId = c.get('userId')!;
  const slug = c.req.param('slug');
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectBySlug(slug);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Not found' }, 404);
  return c.json(project);
});

projects.patch('/:id', async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('id');
  const body = (await c.req.json()) as {
    name?: string;
    rate_limit_rpm?: number;
    rate_limit_enabled?: boolean;
  };

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  // Verify ownership
  const existing = await db.getProjectById(projectId);
  if (!existing) return c.json({ error: 'Project not found' }, 404);
  if (existing.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  // Validate rate_limit_rpm
  if (body.rate_limit_rpm !== undefined) {
    if (typeof body.rate_limit_rpm !== 'number' || body.rate_limit_rpm < 1 || body.rate_limit_rpm > 10000) {
      return c.json({ error: 'rate_limit_rpm must be a number between 1 and 10000' }, 400);
    }
  }

  // Validate rate_limit_enabled
  if (body.rate_limit_enabled !== undefined && typeof body.rate_limit_enabled !== 'boolean') {
    return c.json({ error: 'rate_limit_enabled must be a boolean' }, 400);
  }

  const updated = await db.updateProject(projectId, {
    name: body.name,
    rate_limit_rpm: body.rate_limit_rpm,
    rate_limit_enabled: body.rate_limit_enabled,
  });
  return c.json(updated);
});

// GET /:id/readme (session auth, ownership check)
projects.get('/:id/readme', async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('id');
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Not found' }, 404);
  return c.json({ readme: project.readme || '' });
});

// PUT /:id/readme (session auth, ownership check)
projects.put('/:id/readme', async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('id');
  const body = await c.req.json() as { content: string };
  if (typeof body.content !== 'string') return c.json({ error: 'content is required' }, 400);
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Not found' }, 404);
  await db.updateProject(projectId, { readme: body.content });
  return c.json({ ok: true });
});

projects.delete('/:id', async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('id');

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  // Verify ownership
  const existing = await db.getProjectById(projectId);
  if (!existing) return c.json({ error: 'Project not found' }, 404);
  if (existing.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  await db.deleteProject(projectId);
  return c.json({ ok: true });
});

export { projects };
