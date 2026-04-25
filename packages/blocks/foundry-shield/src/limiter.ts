import { trace, FoundryError } from "@saas-maker/ops";
import type { RateLimitStore } from "./stores/memory.js";

export interface LimiterConfig {
  store: RateLimitStore;
  /**
   * Maximum requests per window
   */
  limit: number;
  /**
   * Window size in milliseconds
   */
  windowMs: number;
  /**
   * Optional project name for tracing
   */
  projectName?: string;
}

export class FoundryShield {
  constructor(private config: LimiterConfig) {}

  /**
   * Checks if a key should be rate limited.
   * Automatically traces the event using @saas-maker/ops.
   */
  async check(key: string): Promise<{ success: boolean; remaining: number; reset: number }> {
    return trace(`shield:check:${this.config.projectName || 'unnamed'}`, async () => {
      const { count, reset } = await this.config.store.increment(key, this.config.windowMs);
      const remaining = Math.max(0, this.config.limit - count);
      const success = count <= this.config.limit;

      if (!success) {
        console.warn(`[Shield] Rate limit exceeded for key: ${key}`);
      }

      return { success, remaining, reset };
    });
  }

  /**
   * Guard function that throws a FoundryError if rate limit is exceeded.
   */
  async guard(key: string): Promise<void> {
    const { success, reset } = await this.check(key);
    if (!success) {
      throw new FoundryError("Too many requests", {
        code: "RATE_LIMIT_EXCEEDED",
        severity: "warn",
        context: { key, resetAt: new Date(reset).toISOString() },
      });
    }
  }
}
