import { PostizError } from './errors';

export interface PostizRateBudgetDecision {
  allowed: boolean;
  remaining: number;
  reset_at: string;
}

export interface PostizRateBudget {
  consume(): PostizRateBudgetDecision;
}

/**
 * Conservative process-local default for Postiz's instance-wide create-post budget.
 * A shared budget can be injected later without changing the client boundary.
 */
export class InMemoryPostizRateBudget implements PostizRateBudget {
  private used = 0;
  private windowStartedAt: number;

  constructor(
    private readonly limit = 90,
    private readonly windowMs = 60 * 60 * 1000,
    private readonly now: () => number = () => Date.now()
  ) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw validationError('rate budget limit must be a positive integer');
    }
    if (!Number.isFinite(windowMs) || windowMs < 1) {
      throw validationError('rate budget window must be positive');
    }
    this.windowStartedAt = now();
  }

  consume(): PostizRateBudgetDecision {
    const current = this.now();
    if (current - this.windowStartedAt >= this.windowMs) {
      this.windowStartedAt = current;
      this.used = 0;
    }
    const allowed = this.used < this.limit;
    if (allowed) this.used += 1;
    return {
      allowed,
      remaining: Math.max(0, this.limit - this.used),
      reset_at: new Date(this.windowStartedAt + this.windowMs).toISOString(),
    };
  }
}

function validationError(message: string): PostizError {
  return new PostizError({ category: 'validation', code: 'POSTIZ_CLIENT_CONFIG', message });
}
