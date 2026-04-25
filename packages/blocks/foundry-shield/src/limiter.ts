import { FoundryErrors } from '@saas-maker/ops';
import { MemoryStore } from './stores/memory.js';
import { D1Store } from './stores/d1.js';
import type { RateLimitStore } from './stores/memory.js';

export interface ShieldConfig {
  store: RateLimitStore;
  windowMs?: number;    // default: 60_000 (1 minute)
  max?: number;         // default: 60 requests per window
  keyPrefix?: string;
  project?: string;
}

export interface ShieldResult {
  allowed: boolean;
  count: number;
  remaining: number;
  limit: number;
}

export class Shield {
  private store: RateLimitStore;
  private windowMs: number;
  private max: number;
  private keyPrefix: string;

  constructor(config: ShieldConfig) {
    this.store = config.store;
    this.windowMs = config.windowMs ?? 60_000;
    this.max = config.max ?? 60;
    this.keyPrefix = config.keyPrefix ?? 'shield';
  }

  /**
   * Check if a key is within rate limit.
   * Returns result — caller decides whether to block.
   */
  async check(identifier: string): Promise<ShieldResult> {
    const key = `${this.keyPrefix}:${identifier}`;
    const count = await this.store.increment(key, this.windowMs);
    return {
      allowed: count <= this.max,
      count,
      remaining: Math.max(0, this.max - count),
      limit: this.max,
    };
  }

  /**
   * Assert rate limit — throws FoundryError.rateLimit() if exceeded.
   */
  async assert(identifier: string): Promise<void> {
    const result = await this.check(identifier);
    if (!result.allowed) {
      throw FoundryErrors.rateLimit(
        `Rate limit exceeded: ${result.count}/${result.limit} requests in window`,
        { identifier, count: result.count, limit: result.limit }
      );
    }
  }

  async reset(identifier: string): Promise<void> {
    await this.store.reset(`${this.keyPrefix}:${identifier}`);
  }
}

/** Convenience: create a Shield with memory store */
export function memoryShield(config?: Partial<ShieldConfig>): Shield {
  return new Shield({ store: new MemoryStore(), ...config });
}

/** Convenience: create a Shield with D1 store */
export function d1Shield(d1: any, config?: Partial<ShieldConfig>): Shield {
  return new Shield({ store: new D1Store(d1), ...config });
}
