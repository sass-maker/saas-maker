import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { Bindings, Variables } from '../types';

export const requireSession = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const session = getCookie(c, 'sm_session');
    if (!session) return c.json({ error: 'Unauthorized' }, 401);
    // TODO: DB session lookup — will set c.set('userId', ...)
    await next();
  }
);

export const requireApiKey = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const apiKey = c.req.header('X-Project-Key');
    if (!apiKey) return c.json({ error: 'Missing X-Project-Key header' }, 401);
    // TODO: DB project lookup — will set c.set('projectId', ...)
    await next();
  }
);
