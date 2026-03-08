import { createMiddleware } from 'hono/factory';
import { Bindings, Variables } from '../types';

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
