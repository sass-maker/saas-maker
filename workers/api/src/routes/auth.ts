import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { resolveBearerUserId } from '../middleware/auth';
import { getDb } from '../db';
import { capture, identify } from '../lib/telemetry';

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

auth.get('/session', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ authenticated: false }, 401);
  }

  const userId = await resolveBearerUserId(c, authHeader.slice(7));
  if (!userId) return c.json({ authenticated: false }, 401);

  const db = getDb(c.env.DB);
  const user = await db.getUserById(userId);
  if (!user) return c.json({ authenticated: false }, 401);

  identify({
    distinctId: user.id,
    properties: { email: user.email, name: user.name ?? undefined },
  });
  capture({ distinctId: user.id, event: 'user_signed_in', properties: { email: user.email } });

  return c.json({ authenticated: true, user });
});

auth.post('/logout', async (c) => {
  // better-auth handles logout on the cockpit side via its own /api/auth route.
  // This endpoint is kept for compatibility but is a no-op.
  return c.json({ ok: true });
});

export { auth };
