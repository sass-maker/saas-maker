import { Hono } from 'hono';
import { getDb } from '../db';
import { foundry_secrets } from '../schema';
import { eq, and, isNull, or } from 'drizzle-orm';
import { Bindings, Variables } from '../types';
import { requireSession } from '../middleware/auth';

export const secrets = new Hono<{ Bindings: Bindings; Variables: Variables }>();

secrets.use('*', requireSession);

/**
 * List all secrets accessible to the user.
 * Includes both global secrets and project-specific secrets.
 */
secrets.get('/', async (c) => {
  const db = getDb(c.env.DB);
  const { project_id } = c.req.query();

  let results;
  if (project_id) {
    // Fetch global secrets AND secrets for the specific project
    results = await db.client
      .select()
      .from(foundry_secrets)
      .where(or(isNull(foundry_secrets.project_id), eq(foundry_secrets.project_id, project_id)));
  } else {
    // Just fetch all (user is authenticated at this point)
    results = await db.client.select().from(foundry_secrets);
  }

  return c.json({ data: results });
});

/**
 * Create or update a secret.
 */
secrets.post('/', async (c) => {
  const db = getDb(c.env.DB);
  const body = await c.req.json();
  const { key, value, project_id } = body;

  if (!key || !value) {
    return c.json({ error: 'Key and value are required' }, 400);
  }

  const id = crypto.randomUUID();

  // Upsert logic (Drizzle doesn't have a clean SQLite upsert for conflict on non-primary yet in some versions)
  // We'll check existence first for simplicity in this factory unit
  const existing = await db.client
    .select()
    .from(foundry_secrets)
    .where(
      and(
        eq(foundry_secrets.key, key),
        project_id ? eq(foundry_secrets.project_id, project_id) : isNull(foundry_secrets.project_id)
      )
    )
    .get();

  if (existing) {
    await db.client
      .update(foundry_secrets)
      .set({ value, updated_at: new Date().toISOString() })
      .where(eq(foundry_secrets.id, existing.id));
    return c.json({ ok: true, action: 'updated', id: existing.id });
  }

  await db.client.insert(foundry_secrets).values({
    id,
    key,
    value,
    project_id: project_id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  return c.json({ ok: true, action: 'created', id });
});

/**
 * Delete a secret.
 */
secrets.delete('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const id = c.req.param('id');

  await db.client.delete(foundry_secrets).where(eq(foundry_secrets.id, id));
  return c.json({ ok: true });
});
