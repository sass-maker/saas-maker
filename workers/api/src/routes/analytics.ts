import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey, requireSession } from '../middleware/auth';
import { getDb } from '../db';
import { parseDevice, parseBrowser } from '../ua';
import type { TrackEventRequest } from '@saasmaker/shared-types';

const analytics = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const DEFAULT_LIMIT = 10;

function parsePeriod(period?: string): Date {
  const now = new Date();
  switch (period) {
    case '7d': return new Date(now.getTime() - 7 * 86400000);
    case '90d': return new Date(now.getTime() - 90 * 86400000);
    default: return new Date(now.getTime() - 30 * 86400000);
  }
}

// --- Ingestion (API key auth) ---

analytics.post('/events', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const body = (await c.req.json()) as TrackEventRequest;

  const ua = c.req.header('User-Agent') || '';
  const country = c.req.header('CF-IPCountry') || null;

  const db = getDb(c.env.DATABASE_URL);
  await db.createEvent({
    id: crypto.randomUUID(),
    project_id: projectId,
    name: body.name || 'page_view',
    url: body.url || null,
    referrer: body.referrer || null,
    utm_source: body.utm_source || null,
    utm_medium: body.utm_medium || null,
    utm_campaign: body.utm_campaign || null,
    country,
    device: parseDevice(ua),
    browser: parseBrowser(ua),
    screen_width: body.screen_width || null,
    properties: body.properties || {},
  });

  return c.json({ ok: true }, 201);
});

// --- Dashboard (session auth) ---

analytics.get('/overview', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const db = getDb(c.env.DATABASE_URL);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const since = parsePeriod(c.req.query('period') || undefined);
  const overview = await db.getAnalyticsOverview(projectId, since);
  return c.json(overview);
});

analytics.get('/pages', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const db = getDb(c.env.DATABASE_URL);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const since = parsePeriod(c.req.query('period') || undefined);
  const data = await db.getTopPages(projectId, since, DEFAULT_LIMIT);
  return c.json({ data });
});

analytics.get('/referrers', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const db = getDb(c.env.DATABASE_URL);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const since = parsePeriod(c.req.query('period') || undefined);
  const data = await db.getTopReferrers(projectId, since, DEFAULT_LIMIT);
  return c.json({ data });
});

analytics.get('/countries', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const db = getDb(c.env.DATABASE_URL);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const since = parsePeriod(c.req.query('period') || undefined);
  const data = await db.getCountryBreakdown(projectId, since, DEFAULT_LIMIT);
  return c.json({ data });
});

analytics.get('/devices', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const db = getDb(c.env.DATABASE_URL);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const since = parsePeriod(c.req.query('period') || undefined);
  const data = await db.getDeviceBreakdown(projectId, since);
  return c.json({ data });
});

analytics.get('/events', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const db = getDb(c.env.DATABASE_URL);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const since = parsePeriod(c.req.query('period') || undefined);
  const data = await db.getCustomEventCounts(projectId, since, DEFAULT_LIMIT);
  return c.json({ data });
});

export { analytics };
