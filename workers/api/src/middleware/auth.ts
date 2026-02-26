import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { Bindings, Variables } from '../types';
import { getDb } from '../db';

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const requireSession = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const session = getCookie(c, 'sm_session');
    if (!session) return c.json({ error: 'Unauthorized' }, 401);

    const db = getDb(c.env.DATABASE_URL);
    const tokenHash = await hashToken(session);
    const sess = await db.getSessionByTokenHash(tokenHash);
    if (!sess) return c.json({ error: 'Unauthorized' }, 401);

    c.set('userId', sess.user_id);
    await next();
  }
);

export const requireApiKey = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const apiKey = c.req.header('X-Project-Key');
    if (!apiKey) return c.json({ error: 'Missing X-Project-Key header' }, 401);

    const db = getDb(c.env.DATABASE_URL);
    const project = await db.getProjectByApiKey(apiKey);
    if (!project) return c.json({ error: 'Invalid API key' }, 401);

    c.set('projectId', project.id);
    await next();
  }
);
