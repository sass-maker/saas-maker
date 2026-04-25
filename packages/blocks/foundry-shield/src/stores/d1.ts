import type { RateLimitStore } from './memory.js';

export class D1Store implements RateLimitStore {
  constructor(private d1: { prepare: (sql: string) => any }) {}

  async increment(key: string, windowMs: number): Promise<number> {
    const windowSec = Math.ceil(windowMs / 1000);
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - windowSec;

    // Clean old entries
    await this.d1.prepare(
      `DELETE FROM shield_requests WHERE key = ? AND ts < ?`
    ).bind(key, windowStart).run();

    // Insert this request
    await this.d1.prepare(
      `INSERT INTO shield_requests (key, ts) VALUES (?, ?)`
    ).bind(key, now).run();

    // Count in window
    const row = await this.d1.prepare(
      `SELECT COUNT(*) as count FROM shield_requests WHERE key = ? AND ts >= ?`
    ).bind(key, windowStart).first();

    return (row as any)?.count ?? 1;
  }

  async reset(key: string): Promise<void> {
    await this.d1.prepare(`DELETE FROM shield_requests WHERE key = ?`).bind(key).run();
  }
}
