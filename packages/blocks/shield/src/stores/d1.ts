import type { RateLimitStore } from "./memory.js";

/**
 * Cloudflare D1 Store for persistent, distributed rate limiting.
 * Requires a table named 'foundry_rate_limits' with schema:
 * CREATE TABLE foundry_rate_limits (key TEXT PRIMARY KEY, count INTEGER, expires INTEGER);
 */
export class D1Store implements RateLimitStore {
  constructor(private d1: any) {}

  async increment(key: string, windowMs: number): Promise<{ count: number; reset: number }> {
    const now = Date.now();
    const expires = now + windowMs;

    try {
      // 1. Try to insert or update existing record
      // We use a transaction to ensure atomicity
      const res = await this.d1.prepare(`
        INSERT INTO foundry_rate_limits (key, count, expires)
        VALUES (?, 1, ?)
        ON CONFLICT(key) DO UPDATE SET
          count = CASE WHEN expires < ? THEN 1 ELSE count + 1 END,
          expires = CASE WHEN expires < ? THEN ? ELSE expires END
        RETURNING count, expires
      `).bind(key, expires, now, now, expires).first();

      return {
        count: res.count,
        reset: res.expires
      };
    } catch (err) {
      console.error("[Shield D1] Failed to increment, failing open.", err);
      return { count: 0, reset: expires };
    }
  }
}
