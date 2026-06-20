import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey, requireSession } from '../middleware/auth';
import { getDb } from '../db';
import { buildCacheKey, tryCacheMatch, withCachePut } from '../edge-cache';
import type { SubmitTestimonialRequest } from '@saas-maker/contracts';
import { capture } from '../lib/telemetry';

const testimonials = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const PAGE_SIZE = 50;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public: submit testimonial (API key)
testimonials.post('/', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const body = (await c.req.json()) as SubmitTestimonialRequest;

  if (!body.author_name?.trim()) return c.json({ error: 'Name is required' }, 400);
  if (!body.author_email?.trim()) return c.json({ error: 'Email is required' }, 400);
  if (!EMAIL_RE.test(body.author_email.trim())) return c.json({ error: 'Invalid email format' }, 400);
  if (!body.content?.trim()) return c.json({ error: 'Content is required' }, 400);
  if (!body.rating || body.rating < 1 || body.rating > 5) return c.json({ error: 'Rating must be 1-5' }, 400);

  const db = getDb(c.env.DB);
  const entry = await db.createTestimonial({
    id: crypto.randomUUID(),
    project_id: projectId,
    author_name: body.author_name.trim(),
    author_email: body.author_email.trim().toLowerCase(),
    author_avatar_url: body.author_avatar_url?.trim() || null,
    author_title: body.author_title?.trim() || null,
    content: body.content.trim(),
    rating: body.rating,
    image_url: body.image_url || null,
    tweet_url: body.tweet_url?.trim() || null,
  });

  capture({ distinctId: entry.author_email, event: 'testimonial_submitted', properties: { testimonial_id: entry.id, project_id: projectId, rating: entry.rating } });
  return c.json({ id: entry.id, status: entry.status, created_at: entry.created_at }, 201);
});

// Public: submit testimonial by project slug (no auth — for /t/[slug] page)
testimonials.post('/by-project/:slug', async (c) => {
  const slug = c.req.param('slug');
  const body = (await c.req.json()) as SubmitTestimonialRequest;

  if (!body.author_name?.trim()) return c.json({ error: 'Name is required' }, 400);
  if (!body.author_email?.trim()) return c.json({ error: 'Email is required' }, 400);
  if (!EMAIL_RE.test(body.author_email.trim())) return c.json({ error: 'Invalid email format' }, 400);
  if (!body.content?.trim()) return c.json({ error: 'Content is required' }, 400);
  if (!body.rating || body.rating < 1 || body.rating > 5) return c.json({ error: 'Rating must be 1-5' }, 400);

  const db = getDb(c.env.DB);
  const project = await db.getProjectBySlug(slug);
  if (!project) return c.json({ error: 'Project not found' }, 404);

  const entry = await db.createTestimonial({
    id: crypto.randomUUID(),
    project_id: project.id,
    author_name: body.author_name.trim(),
    author_email: body.author_email.trim().toLowerCase(),
    author_avatar_url: body.author_avatar_url?.trim() || null,
    author_title: body.author_title?.trim() || null,
    content: body.content.trim(),
    rating: body.rating,
    image_url: body.image_url || null,
    tweet_url: body.tweet_url?.trim() || null,
  });

  capture({ distinctId: entry.author_email, event: 'testimonial_submitted', properties: { testimonial_id: entry.id, project_id: project.id, rating: entry.rating, via: 'public_slug' } });
  return c.json({ id: entry.id, status: entry.status, created_at: entry.created_at }, 201);
});

// Public: get project info by slug (for /t/[slug] page header).
// Cached at the Worker edge — the row is read-mostly and the response is
// tiny. 60 s TTL means owner edits propagate within a minute.
testimonials.get('/by-project/:slug', async (c) => {
  const slug = c.req.param('slug');
  const cacheKey = buildCacheKey('testimonials/project', `${slug}:v1`);

  const hit = await tryCacheMatch(cacheKey);
  if (hit) return hit;

  const db = getDb(c.env.DB);
  const project = await db.getProjectBySlug(slug);
  if (!project) return c.json({ error: 'Project not found' }, 404);

  const response = c.json({ project: { name: project.name, slug: project.slug } });
  return withCachePut(c, cacheKey, response, 60);
});

// Public: list approved testimonials (API key — for wall widget)
testimonials.get('/', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const sort = (c.req.query('sort') || 'newest') as 'newest' | 'rating';
  const db = getDb(c.env.DB);
  const data = await db.listApprovedTestimonials(projectId, limit, sort);
  return c.json({ data });
});

// Dashboard: list all testimonials (session auth)
testimonials.get('/all', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id query param is required' }, 400);

  const page = parseInt(c.req.query('page') || '1', 10);
  const db = getDb(c.env.DB);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const result = await db.listAllTestimonials(projectId, page, PAGE_SIZE);
  const stats = await db.getTestimonialStats(projectId);
  return c.json({ data: result.data, total: result.total, page, limit: PAGE_SIZE, stats });
});

// Dashboard: create testimonial (session auth — project owner)
testimonials.post('/dashboard/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const body = (await c.req.json()) as SubmitTestimonialRequest;

  if (!body.author_name?.trim()) return c.json({ error: 'Name is required' }, 400);
  if (!body.author_email?.trim()) return c.json({ error: 'Email is required' }, 400);
  if (!body.content?.trim()) return c.json({ error: 'Content is required' }, 400);
  if (!body.rating || body.rating < 1 || body.rating > 5) return c.json({ error: 'Rating must be 1-5' }, 400);

  const entry = await db.createTestimonial({
    id: crypto.randomUUID(),
    project_id: projectId,
    author_name: body.author_name.trim(),
    author_email: body.author_email.trim().toLowerCase(),
    author_avatar_url: body.author_avatar_url?.trim() || null,
    author_title: body.author_title?.trim() || null,
    content: body.content.trim(),
    rating: body.rating,
    image_url: body.image_url || null,
    tweet_url: body.tweet_url?.trim() || null,
  });

  return c.json(entry, 201);
});

// Dashboard: update testimonial status (session auth)
testimonials.patch('/:id', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const entryId = c.req.param('id');
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id query param is required' }, 400);

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const body = await c.req.json();
  if (!['pending', 'approved', 'rejected'].includes(body.status)) {
    return c.json({ error: 'Invalid status' }, 400);
  }

  const updated = await db.updateTestimonialStatus(entryId, body.status);
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
});

// Dashboard: delete testimonial (session auth)
testimonials.delete('/:id', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const entryId = c.req.param('id');
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id query param is required' }, 400);

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const deleted = await db.deleteTestimonial(entryId);
  if (!deleted) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

export { testimonials };
