import { createMiddleware } from 'hono/factory';
import { Bindings, Variables } from '../types';

/**
 * Cloudflare Workers built-in rate limiting middleware.
 * Uses the RATE_LIMITER binding if present.
 */
export const rateLimit = (options: { limit: number; period: number }) => 
  createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
    if (!c.env.RATE_LIMITER) {
      return next();
    }

    try {
      // Use the IP address or API key as the key for rate limiting
      const key = c.req.header('X-Project-Key') || c.req.header('CF-Connecting-IP') || 'anonymous';
      const { success } = await c.env.RATE_LIMITER.limit({ key });
      
      if (!success) {
        return c.json({ error: 'Rate limit exceeded' }, 429);
      }
    } catch (err) {
      console.error('Rate limiter error:', err);
      // Fail open if rate limiter has issues
    }
    
    await next();
  });
