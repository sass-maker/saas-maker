import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { decryptAuthJsJwe } from '../middleware/auth';
import { getDb } from '../db';
import { capture, identify } from '@saas-maker/ops';

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

auth.get('/session', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ authenticated: false }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await decryptAuthJsJwe(token, c.env.AUTH_SECRET);
  if (!payload || !payload.sub || !payload.email) {
    return c.json({ authenticated: false }, 401);
  }

  const db = getDb(c.env.DB);
  const user = await db.upsertUser({
    id: payload.sub,
    email: payload.email,
    name: payload.name || null,
    avatar_url: payload.picture || null,
  });

  identify({
    distinctId: user.id,
    properties: { email: user.email, name: user.name ?? undefined },
  });
  capture({ distinctId: user.id, event: 'user_signed_in', properties: { email: user.email } });

  return c.json({ authenticated: true, user });
});

auth.post('/logout', async (c) => {
  // Auth.js handles logout on the dashboard side.
  // This endpoint is kept for compatibility but is a no-op.
  return c.json({ ok: true });
});

export { auth };
