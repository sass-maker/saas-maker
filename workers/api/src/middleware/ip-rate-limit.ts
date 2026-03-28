import { createMiddleware } from 'hono/factory';
import { Bindings, Variables } from '../types';

type HonoEnv = { Bindings: Bindings; Variables: Variables };

// Per-IP sliding windows: "route:ip" -> { count, resetAt }
const windows = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup to avoid unbounded growth
let lastCleanup = Date.now();
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, w] of windows) {
    if (now >= w.resetAt) windows.delete(key);
  }
}

function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export function ipRateLimit(routeKey: string, maxPerHour: number) {
  return createMiddleware<HonoEnv>(async (c, next) => {
    cleanup();

    const ip = getClientIp(c);
    const key = `${routeKey}:${ip}`;
    const now = Date.now();

    let window = windows.get(key);
    if (!window || now >= window.resetAt) {
      window = { count: 0, resetAt: now + 3_600_000 }; // 1 hour
      windows.set(key, window);
    }

    window.count++;

    if (window.count > maxPerHour) {
      const retryAfter = Math.ceil((window.resetAt - now) / 1000);
      c.header('Retry-After', String(retryAfter));
      return c.json({ error: 'Too many requests' }, 429);
    }

    return next();
  });
}
