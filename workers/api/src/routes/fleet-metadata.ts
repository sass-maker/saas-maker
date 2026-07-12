import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireSession } from '../middleware/auth';
import { getDb } from '../db';
import { buildCacheKey, tryCacheMatch, withCachePut } from '../edge-cache';

const fleetMetadata = new Hono<{ Bindings: Bindings; Variables: Variables }>();
fleetMetadata.use('*', requireSession);

fleetMetadata.get('/', async (c) => {
  const userId = c.get('userId')!;
  const cacheKey = buildCacheKey('fleet-metadata', `${userId}:v1`);

  const hit = await tryCacheMatch(cacheKey);
  if (hit) return hit;

  const db = getDb(c.env.DB);
  const projects = await db.getFleetMetadata(userId);
  const response = c.json({ data: projects });
  return withCachePut(c, cacheKey, response, 60);
});

fleetMetadata.post('/', async (c) => {
  const userId = c.get('userId')!;
  const body = (await c.req.json()) as {
    projects: any[];
    replace?: boolean;
    retired_slugs?: string[];
  };
  if (!Array.isArray(body?.projects)) return c.json({ error: 'projects array required' }, 400);

  const projects = body.projects
    .map((p) => ({
      slug: String(p.slug || '').trim(),
      name: String(p.name || p.slug || '').trim(),
      framework: String(p.framework || '-'),
      framework_version: p.frameworkVersion || null,
      db: String(p.db || '-'),
      auth: String(p.auth || '-'),
      deploy: String(p.deploy || '-'),
      test_frameworks: String(p.testFrameworks || '-'),
      saasmaker_count: Number(p.saasmakerCount || 0),
      foundry_linked: Boolean(p.foundryLinked),
      last_scanned: new Date().toISOString(),
    }))
    .filter((p) => p.slug.length > 0);

  const slugs = [...new Set(projects.map((p) => p.slug))];
  if (projects.length !== body.projects.length)
    return c.json({ error: 'project slug required' }, 400);

  const db = getDb(c.env.DB);
  await Promise.all(projects.map((p) => db.upsertFleetMetadata(userId, p)));

  let pruned = 0;
  if (body.replace) {
    pruned += await db.deleteFleetMetadataExcept(userId, slugs);
  }

  if (Array.isArray(body.retired_slugs) && body.retired_slugs.length > 0) {
    const retiredSlugs = body.retired_slugs
      .map((slug) => String(slug || '').trim())
      .filter(Boolean);
    pruned += await db.deleteFleetMetadataBySlugs(userId, retiredSlugs);
  }

  return c.json({ ok: true, count: projects.length, pruned });
});

export { fleetMetadata };
