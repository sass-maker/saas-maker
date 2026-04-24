import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireSession } from '../middleware/auth';
import { getDb } from '../db';

const fleetMetadata = new Hono<{ Bindings: Bindings; Variables: Variables }>();
fleetMetadata.use('*', requireSession);

fleetMetadata.get('/', async (c) => {
  const userId = c.get('userId')!;
  const db = getDb(c.env.DB);
  const projects = await db.getFleetMetadata(userId);
  return c.json({ data: projects });
});

fleetMetadata.post('/', async (c) => {
  const userId = c.get('userId')!;
  const body = await c.req.json() as { projects: any[] };
  if (!Array.isArray(body?.projects)) return c.json({ error: 'projects array required' }, 400);

  const db = getDb(c.env.DB);
  await Promise.all(
    body.projects.map(p => db.upsertFleetMetadata(userId, {
      slug: String(p.slug || ''),
      name: String(p.name || p.slug || ''),
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
  );
  return c.json({ ok: true, count: body.projects.length });
});

export { fleetMetadata };
