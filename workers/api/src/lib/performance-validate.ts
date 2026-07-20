/**
 * Server-side validation for performance receipts and spans.
 * Rejects sensitive fields, unbounded cardinality, and invalid shapes.
 */

const SOURCES = new Set([
  'synthetic-api',
  'psi-swarm',
  'browser-rum',
  'server-runtime',
  'posthog',
  'cloudflare',
  'crux',
  'imported',
]);

const ENVIRONMENTS = new Set(['production', 'staging', 'preview', 'development', 'local']);
const KINDS = new Set(['api', 'web']);
const STATUS_CLASSES = new Set(['1xx', '2xx', '3xx', '4xx', '5xx']);
const OPERATION_KINDS = new Set(['d1', 'sql', 'kv', 'r2', 'external-http', 'ai', 'queue', 'other']);
const PROBE_MODES = new Set(['cold', 'warm', 'mixed']);
const SAFE_METHODS = new Set(['GET', 'HEAD']);

const PROHIBITED_KEYS = new Set([
  'authorization',
  'cookie',
  'cookies',
  'password',
  'secret',
  'token',
  'api_key',
  'apiKey',
  'raw_sql',
  'sql',
  'query',
  'query_string',
  'queryString',
  'body',
  'payload',
  'headers',
  'ip',
  'user_id',
  'userId',
  'email',
  'bind_values',
  'bindValues',
]);

const MAX_LABEL = 160;
const MAX_ROUTE = 200;
const MAX_BATCH = 50;
const MAX_OPS_PER_SPAN = 20;
const MAX_SAMPLES = 100_000;

export type ValidationError = { error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value: unknown, field: string, max = MAX_LABEL): string | ValidationError {
  if (typeof value !== 'string' || !value.trim()) return { error: `${field} is required` };
  const trimmed = value.trim();
  if (trimmed.length > max) return { error: `${field} exceeds ${max} characters` };
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return { error: `${field} contains control characters` };
  return trimmed;
}

function rejectSensitive(obj: Record<string, unknown>, path = ''): ValidationError | null {
  for (const [key, value] of Object.entries(obj)) {
    const full = path ? `${path}.${key}` : key;
    if (PROHIBITED_KEYS.has(key)) return { error: `prohibited field: ${full}` };
    if (key.includes('?') || /^(https?|file):/i.test(key)) {
      return { error: `invalid field name: ${full}` };
    }
    if (isObject(value)) {
      const nested = rejectSensitive(value, full);
      if (nested) return nested;
    }
  }
  return null;
}

function parseIso(value: unknown, field: string): string | ValidationError {
  const s = cleanString(value, field, 64);
  if (typeof s !== 'string') return s;
  if (!Number.isFinite(Date.parse(s))) return { error: `${field} must be an ISO timestamp` };
  return new Date(s).toISOString();
}

function parsePercentiles(value: unknown, field: string): Record<string, number | null> | null | ValidationError {
  if (value == null) return null;
  if (!isObject(value)) return { error: `${field} must be an object` };
  const out: Record<string, number | null> = {};
  for (const key of ['p50', 'p75', 'p90', 'p95', 'p99']) {
    const raw = value[key];
    if (raw == null) {
      out[key] = null;
      continue;
    }
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
      return { error: `${field}.${key} must be a non-negative number` };
    }
    out[key] = raw;
  }
  return out;
}

function parseRoute(value: unknown, field: string): string | ValidationError {
  const route = cleanString(value, field, MAX_ROUTE);
  if (typeof route !== 'string') return route;
  if (route.includes('?') || route.includes('#')) {
    return { error: `${field} must not include query strings or fragments` };
  }
  if (/\/[0-9a-f]{8,}(?:\/|$)/i.test(route) || /\/\d{4,}(?:\/|$)/.test(route)) {
    return { error: `${field} looks high-cardinality; normalize dynamic segments` };
  }
  return route;
}

export interface NormalizedReceipt {
  schema_version: 1;
  idempotency_key: string;
  project_id: string;
  kind: 'api' | 'web';
  surface: string;
  environment: string;
  source: string;
  revision: string | null;
  window_start: string;
  window_end: string;
  sample_count: number;
  error_count: number;
  sampling_rate: number | null;
  probe_mode: string | null;
  method: string | null;
  route_template: string | null;
  latency_ms: Record<string, number | null> | null;
  phases: Record<string, unknown> | null;
  web_vitals: Record<string, unknown> | null;
  diagnostic_ref: string | null;
}

export interface NormalizedOperation {
  kind: string;
  label: string;
  fingerprint: string;
  duration_ms: number;
  success: boolean;
}

export interface NormalizedSpan {
  schema_version: 1;
  idempotency_key: string;
  project_id: string;
  surface: string;
  environment: string;
  source: string;
  revision: string | null;
  observed_at: string;
  trace_id: string;
  method: string;
  route_template: string;
  status_class: string;
  duration_ms: number;
  ttfb_ms: number | null;
  probe_mode: string | null;
  sampling_rate: number | null;
  operations: NormalizedOperation[];
}

export function normalizeReceipt(raw: unknown): NormalizedReceipt | ValidationError {
  if (!isObject(raw)) return { error: 'receipt must be an object' };
  const sensitive = rejectSensitive(raw);
  if (sensitive) return sensitive;

  if (raw.schema_version !== 1) return { error: 'schema_version must be 1' };

  const idempotency_key = cleanString(raw.idempotency_key, 'idempotency_key', 200);
  if (typeof idempotency_key !== 'string') return idempotency_key;

  const project_id = cleanString(raw.project_id, 'project_id');
  if (typeof project_id !== 'string') return project_id;

  const kind = cleanString(raw.kind, 'kind', 16);
  if (typeof kind !== 'string') return kind;
  if (!KINDS.has(kind)) return { error: 'kind must be api or web' };

  const surface = cleanString(raw.surface, 'surface');
  if (typeof surface !== 'string') return surface;

  const environment = cleanString(raw.environment, 'environment', 32);
  if (typeof environment !== 'string') return environment;
  if (!ENVIRONMENTS.has(environment)) return { error: 'invalid environment' };

  const source = cleanString(raw.source, 'source', 32);
  if (typeof source !== 'string') return source;
  if (!SOURCES.has(source)) return { error: 'invalid source' };

  const window_start = parseIso(raw.window_start, 'window_start');
  if (typeof window_start !== 'string') return window_start;
  const window_end = parseIso(raw.window_end, 'window_end');
  if (typeof window_end !== 'string') return window_end;
  if (Date.parse(window_end) < Date.parse(window_start)) {
    return { error: 'window_end must be >= window_start' };
  }

  if (
    typeof raw.sample_count !== 'number' ||
    !Number.isInteger(raw.sample_count) ||
    raw.sample_count < 1 ||
    raw.sample_count > MAX_SAMPLES
  ) {
    return { error: `sample_count must be 1..${MAX_SAMPLES}` };
  }

  const error_count =
    raw.error_count == null
      ? 0
      : typeof raw.error_count === 'number' && Number.isInteger(raw.error_count) && raw.error_count >= 0
        ? raw.error_count
        : -1;
  if (error_count < 0) return { error: 'error_count must be a non-negative integer' };

  let method: string | null = null;
  if (raw.method != null) {
    const m = cleanString(raw.method, 'method', 12);
    if (typeof m !== 'string') return m;
    method = m.toUpperCase();
    if (source === 'synthetic-api' && !SAFE_METHODS.has(method)) {
      return { error: 'synthetic-api receipts may only use GET or HEAD' };
    }
  }

  let route_template: string | null = null;
  if (raw.route_template != null) {
    const r = parseRoute(raw.route_template, 'route_template');
    if (typeof r !== 'string') return r;
    route_template = r;
  }

  const latency_ms = parsePercentiles(raw.latency_ms, 'latency_ms');
  if (latency_ms && 'error' in latency_ms) return latency_ms;

  let probe_mode: string | null = null;
  if (raw.probe_mode != null) {
    const pm = cleanString(raw.probe_mode, 'probe_mode', 16);
    if (typeof pm !== 'string') return pm;
    if (!PROBE_MODES.has(pm)) return { error: 'invalid probe_mode' };
    probe_mode = pm;
  }

  let diagnostic_ref: string | null = null;
  if (raw.diagnostic_ref != null) {
    const d = cleanString(raw.diagnostic_ref, 'diagnostic_ref', 300);
    if (typeof d !== 'string') return d;
    if (d.includes('?') && /token=|key=|secret=/i.test(d)) {
      return { error: 'diagnostic_ref must not embed secrets' };
    }
    diagnostic_ref = d;
  }

  let revision: string | null = null;
  if (raw.revision != null) {
    const rev = cleanString(raw.revision, 'revision', 80);
    if (typeof rev !== 'string') return rev;
    revision = rev;
  }

  const sampling_rate =
    raw.sampling_rate == null
      ? null
      : typeof raw.sampling_rate === 'number' && raw.sampling_rate >= 0 && raw.sampling_rate <= 1
        ? raw.sampling_rate
        : null;
  if (raw.sampling_rate != null && sampling_rate === null) {
    return { error: 'sampling_rate must be between 0 and 1' };
  }

  return {
    schema_version: 1,
    idempotency_key,
    project_id,
    kind: kind as 'api' | 'web',
    surface,
    environment,
    source,
    revision,
    window_start,
    window_end,
    sample_count: raw.sample_count,
    error_count,
    sampling_rate,
    probe_mode,
    method,
    route_template,
    latency_ms: latency_ms as Record<string, number | null> | null,
    phases: isObject(raw.phases) ? (raw.phases as Record<string, unknown>) : null,
    web_vitals: isObject(raw.web_vitals) ? (raw.web_vitals as Record<string, unknown>) : null,
    diagnostic_ref,
  };
}

function normalizeOperation(raw: unknown, index: number): NormalizedOperation | ValidationError {
  if (!isObject(raw)) return { error: `operations[${index}] must be an object` };
  const sensitive = rejectSensitive(raw, `operations[${index}]`);
  if (sensitive) return sensitive;

  const kind = cleanString(raw.kind, `operations[${index}].kind`, 32);
  if (typeof kind !== 'string') return kind;
  if (!OPERATION_KINDS.has(kind)) return { error: `operations[${index}].kind is invalid` };

  const label = cleanString(raw.label, `operations[${index}].label`);
  if (typeof label !== 'string') return label;
  if (label.includes('?') || /^(https?|file):/i.test(label) || /\bselect\b|\binsert\b/i.test(label)) {
    return { error: `operations[${index}].label must be an allowlisted fingerprint label` };
  }

  const fingerprint = cleanString(raw.fingerprint, `operations[${index}].fingerprint`, 128);
  if (typeof fingerprint !== 'string') return fingerprint;

  if (typeof raw.duration_ms !== 'number' || !Number.isFinite(raw.duration_ms) || raw.duration_ms < 0) {
    return { error: `operations[${index}].duration_ms must be non-negative` };
  }
  if (typeof raw.success !== 'boolean') return { error: `operations[${index}].success must be boolean` };

  return {
    kind,
    label,
    fingerprint,
    duration_ms: raw.duration_ms,
    success: raw.success,
  };
}

export function normalizeSpan(raw: unknown): NormalizedSpan | ValidationError {
  if (!isObject(raw)) return { error: 'span must be an object' };
  const sensitive = rejectSensitive(raw);
  if (sensitive) return sensitive;

  if (raw.schema_version !== 1) return { error: 'schema_version must be 1' };

  const idempotency_key = cleanString(raw.idempotency_key, 'idempotency_key', 200);
  if (typeof idempotency_key !== 'string') return idempotency_key;

  const project_id = cleanString(raw.project_id, 'project_id');
  if (typeof project_id !== 'string') return project_id;

  const surface = cleanString(raw.surface, 'surface');
  if (typeof surface !== 'string') return surface;

  const environment = cleanString(raw.environment, 'environment', 32);
  if (typeof environment !== 'string') return environment;
  if (!ENVIRONMENTS.has(environment)) return { error: 'invalid environment' };

  const source = cleanString(raw.source, 'source', 32);
  if (typeof source !== 'string') return source;
  if (!SOURCES.has(source)) return { error: 'invalid source' };

  const observed_at = parseIso(raw.observed_at, 'observed_at');
  if (typeof observed_at !== 'string') return observed_at;

  const trace_id = cleanString(raw.trace_id, 'trace_id', 80);
  if (typeof trace_id !== 'string') return trace_id;

  const methodRaw = cleanString(raw.method, 'method', 12);
  if (typeof methodRaw !== 'string') return methodRaw;
  const method = methodRaw.toUpperCase();

  const route_template = parseRoute(raw.route_template, 'route_template');
  if (typeof route_template !== 'string') return route_template;

  const status_class = cleanString(raw.status_class, 'status_class', 8);
  if (typeof status_class !== 'string') return status_class;
  if (!STATUS_CLASSES.has(status_class)) return { error: 'invalid status_class' };

  if (typeof raw.duration_ms !== 'number' || !Number.isFinite(raw.duration_ms) || raw.duration_ms < 0) {
    return { error: 'duration_ms must be a non-negative number' };
  }

  const ttfb_ms =
    raw.ttfb_ms == null
      ? null
      : typeof raw.ttfb_ms === 'number' && Number.isFinite(raw.ttfb_ms) && raw.ttfb_ms >= 0
        ? raw.ttfb_ms
        : null;
  if (raw.ttfb_ms != null && ttfb_ms === null) return { error: 'ttfb_ms must be non-negative' };

  let probe_mode: string | null = null;
  if (raw.probe_mode != null) {
    const pm = cleanString(raw.probe_mode, 'probe_mode', 16);
    if (typeof pm !== 'string') return pm;
    if (!PROBE_MODES.has(pm)) return { error: 'invalid probe_mode' };
    probe_mode = pm;
  }

  let revision: string | null = null;
  if (raw.revision != null) {
    const rev = cleanString(raw.revision, 'revision', 80);
    if (typeof rev !== 'string') return rev;
    revision = rev;
  }

  const sampling_rate =
    raw.sampling_rate == null
      ? null
      : typeof raw.sampling_rate === 'number' && raw.sampling_rate >= 0 && raw.sampling_rate <= 1
        ? raw.sampling_rate
        : null;
  if (raw.sampling_rate != null && sampling_rate === null) {
    return { error: 'sampling_rate must be between 0 and 1' };
  }

  const opsRaw = Array.isArray(raw.operations) ? raw.operations : [];
  if (opsRaw.length > MAX_OPS_PER_SPAN) {
    return { error: `operations exceeds max ${MAX_OPS_PER_SPAN}` };
  }
  const operations: NormalizedOperation[] = [];
  for (let i = 0; i < opsRaw.length; i++) {
    const op = normalizeOperation(opsRaw[i], i);
    if ('error' in op) return op;
    operations.push(op);
  }

  return {
    schema_version: 1,
    idempotency_key,
    project_id,
    surface,
    environment,
    source,
    revision,
    observed_at,
    trace_id,
    method,
    route_template,
    status_class,
    duration_ms: raw.duration_ms,
    ttfb_ms,
    probe_mode,
    sampling_rate,
    operations,
  };
}

export { MAX_BATCH, PROHIBITED_KEYS, SAFE_METHODS };
