import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireSession } from '../middleware/auth';

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
  const userId = c.get('userId');
  // TODO: db.listProjectsByOwner(userId)
  return c.json({ data: [] });
});

projects.post('/', async (c) => {
  const userId = c.get('userId');
  const body = (await c.req.json()) as { name: string };
  if (!body.name?.trim()) return c.json({ error: 'Project name is required' }, 400);

  const project = {
    id: crypto.randomUUID(),
    name: body.name.trim(),
    slug: slugify(body.name) + '-' + Date.now().toString(36),
    api_key: generateApiKey(),
    owner_id: userId,
    created_at: new Date().toISOString(),
  };
  // TODO: db.createProject(project)
  return c.json(project, 201);
});

projects.patch('/:id', async (c) => {
  const projectId = c.req.param('id');
  const body = (await c.req.json()) as { name?: string };
  // TODO: verify ownership, db.updateProject
  return c.json({ id: projectId, ...body });
});

projects.delete('/:id', async (c) => {
  const projectId = c.req.param('id');
  // TODO: verify ownership, db.deleteProject
  return c.json({ ok: true });
});

export { projects };
