import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey, requireSession } from '../middleware/auth';
import { getDb } from '../db';
import { parseDevice, parseBrowser } from '../ua';
import type { CreateShortLinkRequest, UpdateShortLinkRequest } from '@saas-maker/shared-types';

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateSlug(length = 7): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => BASE62[b % BASE62.length]).join('');
}

const links = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const PAGE_SIZE = 50;
const URL_RE = /^https?:\/\/.+/;

// --- Public redirect ---

export async function handleRedirect(c: any) {
  const slug = c.req.param('slug');
  const db = getDb(c.env.DATABASE_URL);
  const link = await db.getShortLinkBySlug(slug);

  if (!link) return c.json({ error: 'Not found' }, 404);

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return c.json({ error: 'Link has expired' }, 410);
  }

  // Fire click event in background
  const ua = c.req.header('User-Agent') || '';
  const country = c.req.header('CF-IPCountry') || null;
  const referrer = c.req.header('Referer') || null;

  c.executionCtx.waitUntil(
    (async () => {
      await db.incrementLinkClickCount(link.id);
      await db.createEvent({
        id: crypto.randomUUID(),
        project_id: link.project_id,
        name: 'link_click',
        url: link.destination,
        referrer,
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        country,
        device: parseDevice(ua),
        browser: parseBrowser(ua),
        screen_width: null,
        properties: { link_id: link.id, slug: link.slug },
      });
    })()
  );

  return c.redirect(link.destination, 302);
}

// --- API key routes ---

// Create link
links.post('/', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const body = (await c.req.json()) as CreateShortLinkRequest;

  if (!body.destination?.trim()) return c.json({ error: 'destination is required' }, 400);
  if (!URL_RE.test(body.destination.trim())) return c.json({ error: 'destination must be a valid URL' }, 400);

  const slug = body.slug?.trim() || generateSlug();
  if (body.slug && !/^[a-zA-Z0-9_-]+$/.test(body.slug)) {
    return c.json({ error: 'slug must be alphanumeric (hyphens/underscores allowed)' }, 400);
  }

  const db = getDb(c.env.DATABASE_URL);

  try {
    const link = await db.createShortLink({
      id: crypto.randomUUID(),
      project_id: projectId,
      slug,
      destination: body.destination.trim(),
      title: body.title?.trim() || null,
      expires_at: body.expires_at || null,
    });
    return c.json(link, 201);
  } catch (e: any) {
    if (e.message?.includes('duplicate') || e.code === '23505') {
      return c.json({ error: 'Slug already in use' }, 409);
    }
    throw e;
  }
});

// List links
links.get('/', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const page = parseInt(c.req.query('page') || '1', 10);
  const db = getDb(c.env.DATABASE_URL);
  const result = await db.listShortLinks(projectId, page, PAGE_SIZE);
  return c.json({ data: result.data, total: result.total, page, limit: PAGE_SIZE });
});

// --- Dashboard routes (session auth) - MUST be before /:id ---

// Dashboard list
links.get('/dashboard/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const page = parseInt(c.req.query('page') || '1', 10);

  const db = getDb(c.env.DATABASE_URL);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const result = await db.listShortLinks(projectId, page, PAGE_SIZE);
  return c.json({ data: result.data, total: result.total, page, limit: PAGE_SIZE });
});

// Dashboard stats
links.get('/dashboard/:projectId/stats/:id', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const linkId = c.req.param('id');

  const db = getDb(c.env.DATABASE_URL);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const stats = await db.getShortLinkStats(linkId, projectId);
  return c.json(stats);
});

// --- API key routes (continued) ---

// Get single link
links.get('/:id', requireApiKey, async (c) => {
  const linkId = c.req.param('id');
  const db = getDb(c.env.DATABASE_URL);
  const link = await db.getShortLinkById(linkId);
  if (!link) return c.json({ error: 'Not found' }, 404);
  return c.json(link);
});

// Update link
links.patch('/:id', requireApiKey, async (c) => {
  const linkId = c.req.param('id');
  const body = (await c.req.json()) as UpdateShortLinkRequest;

  if (body.destination !== undefined && !URL_RE.test(body.destination.trim())) {
    return c.json({ error: 'destination must be a valid URL' }, 400);
  }

  const db = getDb(c.env.DATABASE_URL);
  const updated = await db.updateShortLink(linkId, {
    destination: body.destination?.trim(),
    title: body.title?.trim(),
    expires_at: body.expires_at,
  });
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
});

// Delete link
links.delete('/:id', requireApiKey, async (c) => {
  const linkId = c.req.param('id');
  const db = getDb(c.env.DATABASE_URL);
  const deleted = await db.deleteShortLink(linkId);
  if (!deleted) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

export { links };
