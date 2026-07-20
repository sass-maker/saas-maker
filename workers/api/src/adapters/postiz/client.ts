import { classifyPostizHttpError, PostizError, redactPostizText } from './errors';
import { InMemoryPostizRateBudget } from './rate-budget';
import type { PostizRateBudget } from './rate-budget';
import type {
  PostizAnalyticsMetric,
  PostizCreatePayload,
  PostizCreateReceipt,
  PostizGateway,
  PostizHealth,
  PostizIntegration,
  PostizPostRecord,
} from './types';

export type PostizFetch = (input: string, init: RequestInit) => Promise<Response>;

export interface PostizClientOptions {
  baseUrl: string;
  apiKey: string;
  fetch?: PostizFetch;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseMs?: number;
  maxRetryDelayMs?: number;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
  rateBudget?: PostizRateBudget;
}

type RetryPolicy = 'safe' | 'never';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
  query?: Record<string, string>;
  retryPolicy?: RetryPolicy;
  consumesCreateBudget?: boolean;
}

export class PostizClient implements PostizGateway {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: PostizFetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly maxRetryDelayMs: number;
  private readonly random: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly rateBudget: PostizRateBudget;

  constructor(options: PostizClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    if (!options.apiKey.trim()) throw clientConfigError('apiKey is required');
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
    this.timeoutMs = boundedInteger(options.timeoutMs ?? 8_000, 1, 60_000, 'timeoutMs');
    this.maxRetries = boundedInteger(options.maxRetries ?? 2, 0, 5, 'maxRetries');
    this.retryBaseMs = boundedInteger(options.retryBaseMs ?? 200, 0, 10_000, 'retryBaseMs');
    this.maxRetryDelayMs = boundedInteger(
      options.maxRetryDelayMs ?? 2_000,
      0,
      30_000,
      'maxRetryDelayMs'
    );
    this.random = options.random ?? Math.random;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.rateBudget = options.rateBudget ?? new InMemoryPostizRateBudget();
  }

  async health(): Promise<PostizHealth> {
    const raw = await this.request('/is-connected');
    const value = asRecord(raw);
    if (!value || typeof value.connected !== 'boolean') throw invalidResponse('health');
    return { connected: value.connected };
  }

  async listIntegrations(): Promise<PostizIntegration[]> {
    const raw = await this.request('/integrations');
    if (!Array.isArray(raw)) throw invalidResponse('integrations');
    return raw.map((entry, index) => normalizeIntegration(entry, index));
  }

  async createPost(payload: PostizCreatePayload): Promise<PostizCreateReceipt[]> {
    const raw = await this.request('/posts', {
      method: 'POST',
      body: payload,
      // Any failed create response is ambiguous: Postiz may have persisted the
      // post before the response was lost or rejected. Reconciliation owns the
      // next step; this transport must never create a duplicate by retrying.
      retryPolicy: 'never',
      consumesCreateBudget: true,
    });
    if (!Array.isArray(raw)) throw invalidResponse('create post');
    return raw.map((entry, index) => {
      const value = asRecord(entry);
      if (!value || typeof value.postId !== 'string' || typeof value.integration !== 'string') {
        throw invalidResponse(`create post receipt ${index}`);
      }
      return { postId: value.postId, integration: value.integration };
    });
  }

  async listPosts(query: { startDate: string; endDate: string }): Promise<PostizPostRecord[]> {
    if (!isIsoDate(query.startDate) || !isIsoDate(query.endDate)) {
      throw validationError('Post list dates must be ISO-8601 timestamps');
    }
    const raw = await this.request('/posts', {
      query: { startDate: query.startDate, endDate: query.endDate },
    });
    const value = asRecord(raw);
    if (!value || !Array.isArray(value.posts)) throw invalidResponse('post list');
    return value.posts.map((entry, index) => normalizePost(entry, index));
  }

  async changePostStatus(
    postId: string,
    status: 'draft' | 'schedule'
  ): Promise<{ id: string; state: 'DRAFT' | 'QUEUE' }> {
    requireIdentifier(postId, 'postId');
    const raw = await this.request(`/posts/${encodeURIComponent(postId)}/status`, {
      method: 'PUT',
      body: { status },
      retryPolicy: 'safe',
    });
    const value = asRecord(raw);
    if (
      !value ||
      typeof value.id !== 'string' ||
      (value.state !== 'DRAFT' && value.state !== 'QUEUE')
    ) {
      throw invalidResponse('post status');
    }
    return { id: value.id, state: value.state };
  }

  async getPostAnalytics(postId: string, days: number): Promise<PostizAnalyticsMetric[]> {
    requireIdentifier(postId, 'postId');
    return this.analytics(`/analytics/post/${encodeURIComponent(postId)}`, days);
  }

  async getPlatformAnalytics(
    integrationId: string,
    days: number
  ): Promise<PostizAnalyticsMetric[]> {
    requireIdentifier(integrationId, 'integrationId');
    return this.analytics(`/analytics/${encodeURIComponent(integrationId)}`, days);
  }

  private async analytics(path: string, days: number): Promise<PostizAnalyticsMetric[]> {
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      throw validationError('Analytics date range must be an integer from 1 to 365 days');
    }
    const raw = await this.request(path, { query: { date: String(days) } });
    if (!Array.isArray(raw)) throw invalidResponse('analytics');
    return raw.map((entry, index) => normalizeAnalytics(entry, index));
  }

  private async request(path: string, options: RequestOptions = {}): Promise<unknown> {
    const method = options.method ?? 'GET';
    const retryPolicy = options.retryPolicy ?? 'safe';
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      attempt += 1;
      if (options.consumesCreateBudget) {
        const budget = this.rateBudget.consume();
        if (!budget.allowed) {
          throw new PostizError({
            category: 'throttling',
            code: 'POSTIZ_RATE_BUDGET_EXHAUSTED',
            message: `Postiz create budget exhausted until ${budget.reset_at}`,
            attempts: attempt,
          });
        }
      }

      try {
        return await this.fetchJson(path, method, options.body, options.query);
      } catch (cause) {
        const error = normalizeError(cause, this.apiKey);
        error.attempts = attempt;
        const retryAllowed = retryPolicy === 'safe';
        if (!retryAllowed || !error.retryable || attempt > this.maxRetries) throw error;
        await this.sleep(this.retryDelay(attempt));
      }
    }
    throw new PostizError({
      category: 'unknown',
      code: 'POSTIZ_RETRY_STATE',
      message: 'Postiz request exhausted its bounded retry loop',
      attempts: attempt,
    });
  }

  private async fetchJson(
    path: string,
    method: 'GET' | 'POST' | 'PUT',
    body?: unknown,
    query?: Record<string, string>
  ): Promise<unknown> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url.toString(), {
        method,
        headers: {
          Authorization: this.apiKey,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) throw classifyPostizHttpError(response.status, text, [this.apiKey]);
      if (!text) return null;
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw invalidResponse('JSON body');
      }
    } catch (cause) {
      if (cause instanceof PostizError) throw cause;
      if (controller.signal.aborted) {
        throw new PostizError({
          category: 'network',
          code: 'POSTIZ_TIMEOUT',
          message: `Postiz request timed out after ${this.timeoutMs}ms`,
          retryable: true,
        });
      }
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new PostizError({
        category: 'network',
        code: 'POSTIZ_NETWORK',
        message: `Postiz network request failed: ${redactPostizText(message, [this.apiKey])}`,
        retryable: true,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private retryDelay(attempt: number): number {
    const exponential = this.retryBaseMs * 2 ** Math.max(0, attempt - 1);
    const jitter = this.retryBaseMs * Math.max(0, Math.min(1, this.random()));
    return Math.min(this.maxRetryDelayMs, Math.round(exponential + jitter));
  }
}

function normalizeIntegration(input: unknown, index: number): PostizIntegration {
  const value = asRecord(input);
  if (
    !value ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.identifier !== 'string' ||
    typeof value.disabled !== 'boolean'
  ) {
    throw invalidResponse(`integration ${index}`);
  }
  return {
    id: value.id,
    name: value.name,
    identifier: value.identifier,
    disabled: value.disabled,
    profile: typeof value.profile === 'string' ? value.profile : null,
  };
}

function normalizePost(input: unknown, index: number): PostizPostRecord {
  const value = asRecord(input);
  const integration = asRecord(value?.integration);
  if (
    !value ||
    typeof value.id !== 'string' ||
    typeof value.publishDate !== 'string' ||
    !integration ||
    typeof integration.id !== 'string' ||
    typeof integration.providerIdentifier !== 'string' ||
    typeof integration.name !== 'string'
  ) {
    throw invalidResponse(`post ${index}`);
  }
  return {
    id: value.id,
    publishDate: value.publishDate,
    releaseURL: typeof value.releaseURL === 'string' ? value.releaseURL : null,
    releaseId: typeof value.releaseId === 'string' ? value.releaseId : null,
    state: typeof value.state === 'string' ? value.state : null,
    integration: {
      id: integration.id,
      providerIdentifier: integration.providerIdentifier,
      name: integration.name,
    },
  };
}

function normalizeAnalytics(input: unknown, index: number): PostizAnalyticsMetric {
  const value = asRecord(input);
  if (!value || typeof value.label !== 'string' || !Array.isArray(value.data)) {
    throw invalidResponse(`analytics metric ${index}`);
  }
  const data = value.data.map((entry, pointIndex) => {
    const point = asRecord(entry);
    if (!point || typeof point.total !== 'string' || typeof point.date !== 'string') {
      throw invalidResponse(`analytics metric ${index} point ${pointIndex}`);
    }
    return { total: point.total, date: point.date };
  });
  return {
    label: value.label,
    data,
    percentageChange: typeof value.percentageChange === 'number' ? value.percentageChange : null,
  };
}

function normalizeBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw clientConfigError('baseUrl must be an absolute HTTP(S) URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw clientConfigError('baseUrl must use HTTP or HTTPS');
  }
  if (url.username || url.password) {
    throw clientConfigError('baseUrl must not contain credentials');
  }
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function boundedInteger(value: number, min: number, max: number, label: string): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw clientConfigError(`${label} must be an integer from ${min} to ${max}`);
  }
  return value;
}

function normalizeError(cause: unknown, apiKey: string): PostizError {
  if (cause instanceof PostizError) return cause;
  const message = cause instanceof Error ? cause.message : String(cause);
  return new PostizError({
    category: 'unknown',
    code: 'POSTIZ_UNKNOWN',
    message: redactPostizText(message, [apiKey]),
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requireIdentifier(value: string, label: string): void {
  if (!value.trim()) throw validationError(`${label} is required`);
}

function isIsoDate(value: string): boolean {
  return value.trim() !== '' && !Number.isNaN(Date.parse(value));
}

function invalidResponse(surface: string): PostizError {
  return new PostizError({
    category: 'provider',
    code: 'POSTIZ_INVALID_RESPONSE',
    message: `Postiz returned an invalid ${surface} response`,
  });
}

function validationError(message: string): PostizError {
  return new PostizError({ category: 'validation', code: 'POSTIZ_VALIDATION', message });
}

function clientConfigError(message: string): PostizError {
  return new PostizError({ category: 'validation', code: 'POSTIZ_CLIENT_CONFIG', message });
}
