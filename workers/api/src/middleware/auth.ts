import { createMiddleware } from 'hono/factory';
import { Bindings, Variables } from '../types';
import { getDb } from '../db';

/**
 * Resolve a better-auth opaque session token (issued by the cockpit) against
 * the shared D1 `session` table. Mirrors the user into the API's `users` table
 * so downstream handlers can key off `users.id`.
 *
 * Returns the resolved user id, or null if the token is unknown / expired.
 */
async function resolveBetterAuthSession(c: { env: Bindings }, token: string): Promise<string | null> {
  const row = await c.env.DB.prepare(
    `SELECT s.userId, s.expiresAt, u.email, u.name, u.image
     FROM session s
     JOIN user u ON u.id = s.userId
     WHERE s.token = ?`
  ).bind(token).first<{ userId: string; expiresAt: string | number; email: string; name: string | null; image: string | null }>();
  if (!row) return null;
  // expiresAt is a unix-timestamp (better-auth sqlite mode: 'timestamp' = seconds)
  const expiresMs = typeof row.expiresAt === 'number' ? row.expiresAt * 1000 : Date.parse(String(row.expiresAt));
  if (Number.isFinite(expiresMs) && expiresMs < Date.now()) return null;

  const db = getDb(c.env.DB);
  const user = await db.upsertUser({
    id: row.userId,
    email: row.email,
    name: row.name,
    avatar_url: row.image,
  });
  return user.id;
}

/**
 * Resolve any Bearer token the API accepts to a user id, or null. Tries CLI
 * tokens (`sm_` prefix) then better-auth opaque session tokens.
 */
export async function resolveBearerUserId(c: { env: Bindings }, token: string): Promise<string | null> {
  if (token.startsWith('sm_')) {
    const db = getDb(c.env.DB);
    const cliToken = await db.getCliTokenUser(token);
    return cliToken?.user_id ?? null;
  }
  return resolveBetterAuthSession(c, token);
}

export const requireSession = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = await resolveBearerUserId(c, authHeader.slice(7));
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    c.set('userId', userId);
    await next();
  }
);

export const requireApiKeyOrSession = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const apiKey = c.req.header('X-Project-Key');
    if (apiKey) {
      const db = getDb(c.env.DB);
      const project = await db.getProjectByApiKey(apiKey);
      if (!project) return c.json({ error: 'Invalid API key' }, 401);
      c.set('projectId', project.id);
      c.set('project', project);
      return next();
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = await resolveBearerUserId(c, authHeader.slice(7));
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    c.set('userId', userId);
    await next();
  }
);

export const requireApiKey = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const apiKey = c.req.header('X-Project-Key');
    if (!apiKey) return c.json({ error: 'Missing X-Project-Key header' }, 401);

    const db = getDb(c.env.DB);
    const project = await db.getProjectByApiKey(apiKey);
    if (!project) return c.json({ error: 'Invalid API key' }, 401);

    c.set('projectId', project.id);
    c.set('project', project);
    await next();
  }
);
