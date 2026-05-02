import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireSession } from '../middleware/auth';
import { getDb } from '../db';
import { capture } from '@saas-maker/ops';

const symphony = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const MAX_MEMORY_LENGTH = 50000;

symphony.get('/memory', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const db = getDb(c.env.DB);
  const row = await db.getSymphonyMemory(userId);
  return c.json({
    data: row ?? {
      owner_id: userId,
      content: '',
      updated_at: null,
    },
  });
});

symphony.put('/memory', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const body = await c.req.json() as { content?: unknown };
  if (typeof body.content !== 'string') {
    return c.json({ error: 'content is required' }, 400);
  }
  if (body.content.length > MAX_MEMORY_LENGTH) {
    return c.json({ error: `content must be ${MAX_MEMORY_LENGTH} characters or fewer` }, 400);
  }

  const db = getDb(c.env.DB);
  const data = await db.upsertSymphonyMemory(userId, body.content);
  capture({ distinctId: userId, event: 'symphony_memory_updated' });
  return c.json({ data });
});

export { symphony };
