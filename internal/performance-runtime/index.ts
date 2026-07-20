/**
 * Dependency-free reference runtime timing adapter for maintained APIs.
 * Telemetry delivery failures never delay or fail the product request.
 */

export type RuntimeEnvironment =
  | 'production'
  | 'staging'
  | 'preview'
  | 'development'
  | 'local';

export type OperationKind =
  | 'd1'
  | 'sql'
  | 'kv'
  | 'r2'
  | 'external-http'
  | 'ai'
  | 'queue'
  | 'other';

export interface RuntimeAdapterOptions {
  projectId: string;
  surface: string;
  environment?: RuntimeEnvironment;
  revision?: string | null;
  /** Foundry ingest base, e.g. https://api.sassmaker.com */
  ingestBaseUrl: string;
  /** Project API key for X-Project-Key */
  apiKey: string;
  /** 0..1 success sampling rate (default 0.1) */
  successSampleRate?: number;
  /** Always sample errors (default true) */
  sampleErrors?: boolean;
  /** Always sample requests slower than this ms (default 1000) */
  slowThresholdMs?: number;
  /** Cap emitted spans per route template per minute (default 120) */
  perRoutePerMinuteCap?: number;
  /** Optional fetch implementation (defaults to global fetch) */
  fetchImpl?: typeof fetch;
  /** Optional clock */
  now?: () => number;
}

export interface DownstreamOperation {
  kind: OperationKind;
  label: string;
  fingerprint: string;
  duration_ms: number;
  success: boolean;
}

export interface RequestTimingInput {
  method: string;
  routeTemplate: string;
  status: number;
  durationMs: number;
  ttfbMs?: number | null;
  operations?: DownstreamOperation[];
}

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
const LONG_HEX_RE = /\/[0-9a-f]{12,}(?=\/|$)/gi;
const LONG_NUM_RE = /\/\d{4,}(?=\/|$)/g;

export function normalizeRouteTemplate(pathOrTemplate: string): string {
  let route = pathOrTemplate.split('?')[0]?.split('#')[0] ?? '/';
  if (!route.startsWith('/')) route = `/${route}`;
  route = route
    .replace(UUID_RE, ':id')
    .replace(LONG_HEX_RE, '/:id')
    .replace(LONG_NUM_RE, '/:id')
    .replace(/\/{2,}/g, '/');
  if (route.length > 200) route = `${route.slice(0, 197)}...`;
  return route;
}

export function statusClass(status: number): '1xx' | '2xx' | '3xx' | '4xx' | '5xx' {
  if (status >= 500) return '5xx';
  if (status >= 400) return '4xx';
  if (status >= 300) return '3xx';
  if (status >= 200) return '2xx';
  return '1xx';
}

export function fingerprintLabel(kind: OperationKind, label: string): string {
  const cleaned = label.trim().slice(0, 160);
  if (!cleaned || cleaned.includes('?') || /^(https?|file):/i.test(cleaned)) {
    throw new Error('operation label must be a short allowlisted name, not a URL/query');
  }
  if (/\b(select|insert|update|delete)\b/i.test(cleaned) && kind === 'sql') {
    throw new Error('raw SQL is not allowed; pass an allowlisted label');
  }
  return cleaned;
}

export async function hashFingerprint(parts: string[]): Promise<string> {
  const data = new TextEncoder().encode(parts.join('|'));
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 32);
  }
  // Fallback for environments without subtle crypto
  let h = 0;
  for (const ch of parts.join('|')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `fp_${h.toString(16)}`;
}

export function createRuntimeAdapter(options: RuntimeAdapterOptions) {
  const successRate = options.successSampleRate ?? 0.1;
  const sampleErrors = options.sampleErrors ?? true;
  const slowThresholdMs = options.slowThresholdMs ?? 1000;
  const cap = options.perRoutePerMinuteCap ?? 120;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => Date.now());
  const minuteBuckets = new Map<string, { minute: number; count: number }>();

  function shouldSample(status: number, durationMs: number, route: string): {
    sample: boolean;
    rate: number;
  } {
    const isError = status >= 400;
    const isSlow = durationMs >= slowThresholdMs;
    let rate = successRate;
    if (isError && sampleErrors) rate = 1;
    else if (isSlow) rate = 1;

    const minute = Math.floor(now() / 60_000);
    const bucket = minuteBuckets.get(route);
    if (!bucket || bucket.minute !== minute) {
      minuteBuckets.set(route, { minute, count: 0 });
    }
    const current = minuteBuckets.get(route)!;
    if (current.count >= cap) return { sample: false, rate };

    if (Math.random() > rate) return { sample: false, rate };
    current.count += 1;
    return { sample: true, rate };
  }

  async function deliver(span: Record<string, unknown>): Promise<void> {
    try {
      await fetchImpl(new URL('/v1/performance/spans', options.ingestBaseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Project-Key': options.apiKey,
        },
        body: JSON.stringify(span),
      });
    } catch {
      // Isolation: never surface telemetry failures to the product path.
    }
  }

  return {
    /**
     * Record a request timing. Returns a promise for the optional async delivery
     * so callers can `waitUntil` it; the product path must not await it for success.
     */
    recordRequest(input: RequestTimingInput): Promise<void> | null {
      const route = normalizeRouteTemplate(input.routeTemplate);
      const { sample, rate } = shouldSample(input.status, input.durationMs, route);
      if (!sample) return null;

      const span = {
        schema_version: 1,
        idempotency_key: `span_${crypto.randomUUID()}`,
        project_id: options.projectId,
        surface: options.surface,
        environment: options.environment ?? 'production',
        source: 'server-runtime',
        revision: options.revision ?? null,
        observed_at: new Date(now()).toISOString(),
        trace_id: `tr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
        method: input.method.toUpperCase(),
        route_template: route,
        status_class: statusClass(input.status),
        duration_ms: input.durationMs,
        ttfb_ms: input.ttfbMs ?? null,
        sampling_rate: rate,
        operations: (input.operations ?? []).map((op) => ({
          kind: op.kind,
          label: fingerprintLabel(op.kind, op.label),
          fingerprint: op.fingerprint,
          duration_ms: op.duration_ms,
          success: op.success,
        })),
      };

      return deliver(span);
    },
  };
}

export type RuntimeAdapter = ReturnType<typeof createRuntimeAdapter>;
