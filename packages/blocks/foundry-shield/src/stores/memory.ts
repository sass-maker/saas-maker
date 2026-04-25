export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<number>;
  reset(key: string): Promise<void>;
}

export class MemoryStore implements RateLimitStore {
  private windows = new Map<string, { count: number; resetAt: number }>();

  async increment(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const existing = this.windows.get(key);
    if (!existing || now >= existing.resetAt) {
      this.windows.set(key, { count: 1, resetAt: now + windowMs });
      return 1;
    }
    existing.count++;
    return existing.count;
  }

  async reset(key: string): Promise<void> {
    this.windows.delete(key);
  }
}
