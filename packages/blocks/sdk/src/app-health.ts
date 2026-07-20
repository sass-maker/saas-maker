const DEFAULT_INGEST_URL = 'https://api.sassmaker.com/v1/performance/spans';
const MAX_SERVER_BATCH = 50;
const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const HEX_SEGMENT = /^[0-9a-f]{8,}$/i;

export interface AppHealthOptions {
  apiKey: string;
  ingestUrl?: string;
  release?: string;
  surface?: string;
  environment?: 'production' | 'staging' | 'preview' | 'development' | 'local';
  maxQueueSize?: number;
  maxBatchSize?: number;
  flushIntervalMs?: number;
  requestTimeoutMs?: number;
  maxRetries?: number;
  retryBackoffMs?: number;
  fetch?: typeof fetch;
  now?: () => number;
  randomUUID?: () => string;
  disableTimer?: boolean;
}

export interface AppHealthRecord {
  method: unknown;
  route: unknown;
  statusCode: unknown;
  durationMs: unknown;
  observedAt?: unknown;
}

export interface AppHealthDiagnostics {
  queued: number;
  sent: number;
  droppedInvalid: number;
  droppedOverflow: number;
  droppedDelivery: number;
  failedBatches: number;
  retriedBatches: number;
  lastError: string | null;
}

export type ExpressCompatibleMiddleware = (
  request: {
    method?: unknown;
    baseUrl?: unknown;
    path?: unknown;
    url?: unknown;
    route?: { path?: unknown };
  },
  response: {
    statusCode?: unknown;
    on(event: 'finish', listener: () => void): unknown;
  },
  next: () => void
) => void;

export interface AppHealthClient {
  record(event: AppHealthRecord): void;
  expressMiddleware(): ExpressCompatibleMiddleware;
  flush(): Promise<void>;
  close(): Promise<void>;
  diagnostics(): Readonly<AppHealthDiagnostics>;
}

interface SpanPayload {
  schema_version: 1;
  idempotency_key: string;
  surface: string;
  environment: string;
  source: 'server-runtime';
  revision?: string;
  observed_at: string;
  trace_id: string;
  method: string;
  route_template: string;
  status_class: string;
  duration_ms: number;
  sampling_rate: 1;
  operations: [];
}

const DEFAULTS = {
  maxQueueSize: 1_000,
  maxBatchSize: 50,
  flushIntervalMs: 5_000,
  requestTimeoutMs: 2_000,
  maxRetries: 2,
  retryBackoffMs: 100,
} as const;

export function createAppHealth(options: AppHealthOptions): AppHealthClient {
  if (!options || typeof options.apiKey !== 'string' || !options.apiKey.trim()) {
    throw new Error('@saas-maker/sdk: App Health requires a non-empty apiKey');
  }
  const ingestUrl = validHttpUrl(options.ingestUrl ?? DEFAULT_INGEST_URL, 'ingestUrl');
  const surface = boundedLabel(options.surface ?? 'api', 'surface', 160);
  const environment = normalizeEnvironment(options.environment ?? 'production');
  const release = options.release ? boundedLabel(options.release, 'release', 80) : undefined;
  const maxQueueSize = integerOption(
    options.maxQueueSize ?? DEFAULTS.maxQueueSize,
    'maxQueueSize',
    1,
    100_000
  );
  const maxBatchSize = integerOption(
    options.maxBatchSize ?? DEFAULTS.maxBatchSize,
    'maxBatchSize',
    1,
    MAX_SERVER_BATCH
  );
  const flushIntervalMs = integerOption(
    options.flushIntervalMs ?? DEFAULTS.flushIntervalMs,
    'flushIntervalMs',
    1,
    3_600_000
  );
  const requestTimeoutMs = integerOption(
    options.requestTimeoutMs ?? DEFAULTS.requestTimeoutMs,
    'requestTimeoutMs',
    1,
    60_000
  );
  const maxRetries = integerOption(options.maxRetries ?? DEFAULTS.maxRetries, 'maxRetries', 0, 10);
  const retryBackoffMs = integerOption(
    options.retryBackoffMs ?? DEFAULTS.retryBackoffMs,
    'retryBackoffMs',
    0,
    60_000
  );
  const apiKey = options.apiKey.trim();
  const fetchFn = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const randomUUID = options.randomUUID ?? (() => crypto.randomUUID());
  const queue: SpanPayload[] = [];
  const stats: AppHealthDiagnostics = {
    queued: 0,
    sent: 0,
    droppedInvalid: 0,
    droppedOverflow: 0,
    droppedDelivery: 0,
    failedBatches: 0,
    retriedBatches: 0,
    lastError: null,
  };
  let timer: ReturnType<typeof setTimeout> | null = null;
  let flushing: Promise<void> | null = null;
  let closed = false;
  let closing: Promise<void> | null = null;

  function schedule(): void {
    if (options.disableTimer || closed || timer) return;
    timer = setTimeout(() => {
      timer = null;
      void flush().finally(() => {
        if (queue.length > 0) schedule();
      });
    }, flushIntervalMs);
    (timer as typeof timer & { unref?: () => void }).unref?.();
  }

  function record(event: AppHealthRecord): void {
    if (closed) return;
    const method = normalizeMethod(event.method);
    const route = normalizeAppHealthRoute(event.route);
    const statusCode = normalizeStatus(event.statusCode);
    const durationMs = normalizeDuration(event.durationMs);
    const observedAt = normalizeObservedAt(event.observedAt, now);
    if (!method || !route || statusCode === null || durationMs === null || !observedAt) {
      stats.droppedInvalid += 1;
      return;
    }
    if (queue.length >= maxQueueSize) {
      stats.droppedOverflow += 1;
      return;
    }
    queue.push({
      schema_version: 1,
      idempotency_key: randomUUID(),
      surface,
      environment,
      source: 'server-runtime',
      ...(release ? { revision: release } : {}),
      observed_at: observedAt,
      trace_id: randomUUID(),
      method,
      route_template: route,
      status_class: `${Math.floor(statusCode / 100)}xx`,
      duration_ms: durationMs,
      sampling_rate: 1,
      operations: [],
    });
    stats.queued = queue.length;
    schedule();
    if (queue.length >= maxBatchSize) void flush();
  }

  async function deliver(batch: SpanPayload[]): Promise<void> {
    let lastError = 'delivery failed';
    let retried = false;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      try {
        const response = await fetchFn(ingestUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Project-Key': apiKey,
          },
          body: JSON.stringify({ spans: batch }),
          signal: controller.signal,
          redirect: 'error',
        });
        clearTimeout(timeout);
        if (response.ok) {
          stats.sent += batch.length;
          if (retried) stats.retriedBatches += 1;
          stats.lastError = null;
          return;
        }
        lastError = `ingest responded ${response.status}`;
        if (!retryableStatus(response.status)) break;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error instanceof Error ? error.message : String(error);
      }
      if (attempt < maxRetries) {
        retried = true;
        await sleep(Math.min(retryBackoffMs * 2 ** attempt, retryBackoffMs * 8));
      }
    }
    if (retried) stats.retriedBatches += 1;
    stats.failedBatches += 1;
    stats.droppedDelivery += batch.length;
    stats.lastError = lastError;
  }

  async function flush(): Promise<void> {
    if (flushing) return flushing;
    flushing = (async () => {
      try {
        while (queue.length > 0) {
          const batch = queue.splice(0, maxBatchSize);
          stats.queued = queue.length;
          await deliver(batch);
        }
      } finally {
        flushing = null;
      }
    })();
    return flushing;
  }

  function expressMiddleware(): ExpressCompatibleMiddleware {
    return (request, response, next) => {
      const startedAt = monotonicNow();
      response.on('finish', () => {
        record({
          method: request.method,
          route: resolveExpressRoute(request),
          statusCode: response.statusCode,
          durationMs: Math.max(0, monotonicNow() - startedAt),
        });
      });
      next();
    };
  }

  function close(): Promise<void> {
    if (closing) return closing;
    closed = true;
    if (timer) clearTimeout(timer);
    timer = null;
    closing = flush();
    return closing;
  }

  return {
    record,
    expressMiddleware,
    flush,
    close,
    diagnostics: () => Object.freeze({ ...stats, queued: queue.length }),
  };
}

export function normalizeAppHealthRoute(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const path = value.split('?', 1)[0]!.split('#', 1)[0]!.trim();
  if (!path.startsWith('/')) return null;
  const normalized =
    path
      .split('/')
      .map((segment) => {
        if (!segment) return segment;
        if (/^:\w+$/.test(segment) || /^\{[^}]+\}$/.test(segment)) return segment;
        if (/^\d+$/.test(segment) || UUID_SEGMENT.test(segment) || HEX_SEGMENT.test(segment)) {
          return ':id';
        }
        return segment;
      })
      .join('/') || '/';
  return normalized.length <= 200 ? normalized : null;
}

function resolveExpressRoute(request: Parameters<ExpressCompatibleMiddleware>[0]): unknown {
  const routePath = request.route?.path;
  if (typeof routePath === 'string') {
    const baseUrl = typeof request.baseUrl === 'string' ? request.baseUrl : '';
    return `${baseUrl}${routePath}` || '/';
  }
  return null;
}

function normalizeMethod(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const method = value.trim().toUpperCase();
  return /^[A-Z]{1,12}$/.test(method) ? method : null;
}

function normalizeEnvironment(value: unknown): SpanPayload['environment'] {
  if (
    typeof value !== 'string' ||
    !['production', 'staging', 'preview', 'development', 'local'].includes(value)
  ) {
    throw new Error('@saas-maker/sdk: environment is invalid');
  }
  return value;
}

function normalizeStatus(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : null;
}

function normalizeDuration(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.min(Math.round(value), 600_000);
}

function normalizeObservedAt(value: unknown, now: () => number): string | null {
  if (value == null) return new Date(now()).toISOString();
  if (typeof value === 'number' || typeof value === 'string') {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return date.toISOString();
  }
  return null;
}

function boundedLabel(value: string, name: string, max: number): string {
  const label = value.trim();
  const hasControlCharacter = [...label].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
  if (!label || label.length > max || hasControlCharacter) {
    throw new Error(`@saas-maker/sdk: ${name} must be a bounded non-empty label`);
  }
  return label;
}

function validHttpUrl(value: string, name: string): string {
  try {
    const url = new URL(value);
    const loopback =
      url.hostname === 'localhost' ||
      url.hostname === '::1' ||
      url.hostname === '[::1]' ||
      /^127\./.test(url.hostname);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      (url.protocol === 'http:' && !loopback) ||
      url.username ||
      url.password
    ) {
      throw new Error('invalid URL');
    }
    return url.toString();
  } catch {
    throw new Error(
      `@saas-maker/sdk: ${name} must be an HTTPS URL without credentials (HTTP is loopback-only)`
    );
  }
}

function integerOption(value: number, name: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`@saas-maker/sdk: ${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function retryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function monotonicNow(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
