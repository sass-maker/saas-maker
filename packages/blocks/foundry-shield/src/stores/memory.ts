export interface RateLimitStore {
  /**
   * Increments the count for a key and returns the current value.
   * @param key The unique key to rate limit (e.g. user-ip)
   * @param windowMs The sliding window size in milliseconds
   */
  increment(key: string, windowMs: number): Promise<{ count: number; reset: number }>;
}

export class MemoryStore implements RateLimitStore {
  private cache = new Map<string, { count: number; expires: number }>();

  async increment(key: string, windowMs: number): Promise<{ count: number; reset: number }> {
    const now = Date.now();
    const entry = this.cache.get(key);

    if (!entry || now > entry.expires) {
      const newEntry = { count: 1, expires: now + windowMs };
      this.cache.set(key, newEntry);
      return { count: 1, reset: newEntry.expires };
    }

    entry.count += 1;
    return { count: entry.count, reset: entry.expires };
  }

  /**
   * Cleanup expired entries to prevent memory leaks
   */
  prune() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) this.cache.delete(key);
    }
  }
}
