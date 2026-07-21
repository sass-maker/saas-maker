import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireSession } from '../middleware/auth';
import { getDb } from '../db';
import { trace, capture } from '../lib/telemetry';
import { buildCacheKey, tryCacheMatch, withCachePut } from '../edge-cache';
import type { ProjectRecord } from '@saas-maker/contracts';

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

type ProjectRow = ProjectRecord & {
  embedding_model?: string | null;
  ai_base_url?: string | null;
  ai_api_key?: string | null;
  ai_model?: string | null;
};

function toPublicProject(project: ProjectRow) {
  const {
    ai_api_key: _apiKey,
    ai_base_url: _baseUrl,
    ai_model: _model,
    embedding_model: _embeddingModel,
    ...safeProject
  } = project;
  return safeProject;
}

projects.get('/', async (c) => {
  const userId = c.get('userId')!;
  const source = c.req.query('source') || 'dashboard';
  const cacheKey = buildCacheKey('projects/list', `${userId}:${source}:v1`);

  const hit = await tryCacheMatch(cacheKey);
  if (hit) return hit;

  const db = getDb(c.env.DB);
  const data = await trace<ProjectRow[]>(
    'db:listProjects',
    () => db.listProjectsByOwner(userId, source) as Promise<ProjectRow[]>,
    { projectId: 'saasmaker-api' }
  );
  const response = c.json({ data: data.map((project) => toPublicProject(project)) });
  return withCachePut(c, cacheKey, response, 60);
});

const VALID_SOURCES = ['dashboard', 'linkchat'];

projects.post('/', async (c) => {
  const userId = c.get('userId')!;
  const body = (await c.req.json()) as { name: string; source?: string; git_url?: string };
  if (!body.name?.trim()) return c.json({ error: 'Project name is required' }, 400);

  const source = body.source || 'dashboard';
  if (!VALID_SOURCES.includes(source)) {
    return c.json({ error: `Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}` }, 400);
  }

  const gitUrl = body.git_url?.trim() || null;

  const db = getDb(c.env.DB);
  const project = await db.createProject({
    id: crypto.randomUUID(),
    name: body.name.trim(),
    slug: `${slugify(body.name)}-${Date.now().toString(36)}`,
    api_key: generateApiKey(),
    owner_id: userId,
    source,
    git_url: gitUrl,
  });

  capture({
    distinctId: userId,
    event: 'project_created',
    properties: { project_id: project.id, project_name: project.name, source },
  });

  return c.json(toPublicProject(project), 201);
});

projects.get('/by-slug/:slug', async (c) => {
  const userId = c.get('userId')!;
  const slug = c.req.param('slug');
  const db = getDb(c.env.DB);
  const project = await db.getProjectBySlug(slug);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Not found' }, 404);
  return c.json(toPublicProject(project));
});

projects.patch('/:id', async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('id');
  const body = (await c.req.json()) as {
    name?: string;
    readme?: string;
    git_url?: string | null;
  };

  const db = getDb(c.env.DB);

  // Verify ownership
  const existing = await db.getProjectById(projectId);
  if (!existing) return c.json({ error: 'Project not found' }, 404);
  if (existing.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const gitUrl = body.git_url === undefined ? undefined : body.git_url?.trim?.() || null;

  const updated = await db.updateProject(projectId, {
    name: body.name,
    readme: body.readme,
    git_url: gitUrl,
  });
  if (!updated) return c.json({ error: 'Project not found' }, 404);
  capture({ distinctId: userId, event: 'project_updated', properties: { project_id: projectId } });
  return c.json(toPublicProject(updated));
});

projects.delete('/:id', async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('id');

  const db = getDb(c.env.DB);

  // Verify ownership
  const existing = await db.getProjectById(projectId);
  if (!existing) return c.json({ error: 'Project not found' }, 404);
  if (existing.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  await db.deleteProject(projectId);
  capture({
    distinctId: userId,
    event: 'project_deleted',
    properties: { project_id: projectId, project_name: existing.name },
  });
  return c.json({ ok: true });
});

export { projects };
