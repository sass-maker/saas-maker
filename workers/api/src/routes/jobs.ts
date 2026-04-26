import { Hono } from 'hono';
import { getDb } from '../db';
import { foundry_jobs } from '../schema';
import { eq, desc } from 'drizzle-orm';
import { Bindings, Variables } from '../types';
import { requireSession } from '../middleware/auth';

export const jobs = new Hono<{ Bindings: Bindings; Variables: Variables }>();

jobs.use('*', requireSession);

/**
 * List recent agent jobs
 */
jobs.get('/', async (c) => {
  const db = getDb(c.env.DB);
  const results = await db.client
    .select()
    .from(foundry_jobs)
    .orderBy(desc(foundry_jobs.created_at))
    .limit(50);
  return c.json({ data: results });
});

/**
 * Update job logs (internal/privileged)
 */
jobs.post('/:id/logs', async (c) => {
  const db = getDb(c.env.DB);
  const id = c.req.param('id');
  const { logs, status } = await c.req.json();

  await db.client
    .update(foundry_jobs)
    .set({ 
      logs, 
      status, 
      updated_at: new Date().toISOString() 
    })
    .where(eq(foundry_jobs.id, id));

  return c.json({ ok: true });
});
