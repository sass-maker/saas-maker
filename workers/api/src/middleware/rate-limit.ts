import { createMiddleware } from 'hono/factory';
import { d1Shield } from '@saas-maker/foundry-shield';
import { Bindings, Variables, AppContext } from '../types';

// Add D1 shield for unauthenticated endpoints (more reliable than in-memory)
export const d1RateLimit = (key: string, maxPerMinute = 10) =>
  createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
    const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
    const shield = d1Shield(c.env.DB, { max: maxPerMinute, windowMs: 60_000, keyPrefix: key });
    try {
      await shield.assert(`${key}:${ip}`);
    } catch {
      return c.json({ error: 'Too many requests' }, 429);
    }
    await next();
  });

// Slug-scoped D1 shield — key derived from the request context
export const d1RateLimitDynamic = (keyFn: (c: AppContext) => string, maxPerHour = 10) =>
  createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
    const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';
    const key = keyFn(c);
    const shield = d1Shield(c.env.DB, { max: maxPerHour, windowMs: 60 * 60 * 1000, keyPrefix: 'shield' });
    try {
      await shield.assert(`${key}:${ip}`);
    } catch {
      return c.json({ error: 'Too many requests' }, 429);
    }
    await next();
  });

// In-memory sliding window: projectId -> { count, resetAt }
const windows = new Map<string, { count: number; resetAt: number }>();

export const rateLimit = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const projectId = c.get('projectId');
    if (!projectId) {
      // Not an API-key route — skip
      return next();
    }

    const project = c.get('project');
    if (!project) {
      // No project cached (shouldn't happen after requireApiKey) — skip
      return next();
    }

    if (!project.rate_limit_enabled) {
      return next();
    }

    const limit = project.rate_limit_rpm ?? 60;
    const now = Date.now();
    const windowKey = projectId;

    let window = windows.get(windowKey);
    if (!window || now >= window.resetAt) {
      window = { count: 0, resetAt: now + 60_000 };
      windows.set(windowKey, window);
    }

    window.count++;

    const remaining = Math.max(0, limit - window.count);
    const retryAfter = Math.ceil((window.resetAt - now) / 1000);

    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(remaining));

    if (window.count > limit) {
      c.header('Retry-After', String(retryAfter));
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    return next();
  }
);
