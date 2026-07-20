import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { requireApiKey, requireSession } from '../middleware/auth';
import {
  MAX_BATCH,
  normalizeReceipt,
  normalizeSpan,
  type NormalizedReceipt,
  type NormalizedSpan,
} from '../lib/performance-validate';

const performanceRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const SPAN_RETENTION_DAYS = 7;
const ROLLUP_RETENTION_MONTHS = 13;
const CLEANUP_BATCH = 500;
const MAX_BODY_BYTES = 256 * 1024;
const MAX_QUERY_ROWS = 5_000;
const PER_ROUTE_PER_MINUTE_CAP = 120;

async function readBoundedJson(
  request: Request
): Promise<
  { value: unknown; error?: never } | { value?: never; error: string; status: 400 | 413 }
> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return { error: `request body exceeds ${MAX_BODY_BYTES} bytes`, status: 413 };
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return { error: `request body exceeds ${MAX_BODY_BYTES} bytes`, status: 413 };
  }
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { error: 'invalid JSON body', status: 400 };
  }
}

function json(value: unknown): string | null {
  if (value == null) return null;
  return JSON.stringify(value);
}

function parseLimit(raw: string | undefined, fallback: number, max: number): number {
  const n = Number.parseInt(raw ?? String(fallback), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return Number((sorted[lower]! * (1 - weight) + sorted[upper]! * weight).toFixed(3));
}

async function insertReceipt(
  db: D1Database,
  ownerId: string,
  receipt: NormalizedReceipt
): Promise<'accepted' | 'deduped'> {
  const id = crypto.randomUUID();
  const result = await db
    .prepare(
      `INSERT INTO performance_rollups (
        id, owner_id, project_id, idempotency_key, schema_version, kind, surface,
        environment, source, revision, window_start, window_end, sample_count, error_count,
        sampling_rate, probe_mode, probe_origin, method, route_template, latency_json, phases_json,
        web_vitals_json, diagnostic_ref
      ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner_id, project_id, idempotency_key) DO NOTHING`
    )
    .bind(
      id,
      ownerId,
      receipt.project_id,
      receipt.idempotency_key,
      receipt.kind,
      receipt.surface,
      receipt.environment,
      receipt.source,
      receipt.revision,
      receipt.window_start,
      receipt.window_end,
      receipt.sample_count,
      receipt.error_count,
      receipt.sampling_rate,
      receipt.probe_mode,
      receipt.probe_origin,
      receipt.method,
      receipt.route_template,
      json(receipt.latency_ms),
      json(receipt.phases),
      json(receipt.web_vitals),
      receipt.diagnostic_ref
    )
    .run();
  return (result.meta?.changes ?? 0) > 0 ? 'accepted' : 'deduped';
}

async function insertSpan(
  db: D1Database,
  ownerId: string,
  span: NormalizedSpan
): Promise<'accepted' | 'deduped' | 'capped'> {
  const spanId = crypto.randomUUID();
  const minuteStart = new Date(
    Math.floor(Date.parse(span.observed_at) / 60_000) * 60_000
  ).toISOString();
  const minuteEnd = new Date(Date.parse(minuteStart) + 60_000).toISOString();
  const result = await db
    .prepare(
      `INSERT INTO performance_spans (
        id, owner_id, project_id, idempotency_key, schema_version, surface, environment,
        source, revision, observed_at, trace_id, method, route_template, status_class,
        duration_ms, ttfb_ms, probe_mode, sampling_rate
      ) SELECT ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE (
        SELECT COUNT(*) FROM performance_spans
        WHERE owner_id = ? AND project_id = ? AND route_template = ?
          AND observed_at >= ? AND observed_at < ?
      ) < ?
      ON CONFLICT(owner_id, project_id, idempotency_key) DO NOTHING`
    )
    .bind(
      spanId,
      ownerId,
      span.project_id,
      span.idempotency_key,
      span.surface,
      span.environment,
      span.source,
      span.revision,
      span.observed_at,
      span.trace_id,
      span.method,
      span.route_template,
      span.status_class,
      span.duration_ms,
      span.ttfb_ms,
      span.probe_mode,
      span.sampling_rate,
      ownerId,
      span.project_id,
      span.route_template,
      minuteStart,
      minuteEnd,
      PER_ROUTE_PER_MINUTE_CAP
    )
    .run();

  if ((result.meta?.changes ?? 0) === 0) {
    const duplicate = await db
      .prepare(
        `SELECT 1 FROM performance_spans
         WHERE owner_id = ? AND project_id = ? AND idempotency_key = ? LIMIT 1`
      )
      .bind(ownerId, span.project_id, span.idempotency_key)
      .first();
    return duplicate ? 'deduped' : 'capped';
  }

  if (span.operations.length > 0) {
    const statements = span.operations.map((op) =>
      db
        .prepare(
          `INSERT INTO performance_operations (
            id, owner_id, project_id, span_id, trace_id, kind, label, fingerprint,
            duration_ms, success, observed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          ownerId,
          span.project_id,
          spanId,
          span.trace_id,
          op.kind,
          op.label,
          op.fingerprint,
          op.duration_ms,
          op.success ? 1 : 0,
          span.observed_at
        )
    );
    await db.batch(statements);
  }

  return 'accepted';
}

// --- Ingestion (project API key) ------------------------------------------------

const ingest = new Hono<{ Bindings: Bindings; Variables: Variables }>();
ingest.use('/receipts', requireApiKey);
ingest.use('/spans', requireApiKey);

ingest.post('/receipts', async (c) => {
  const project = c.get('project') as { id: string; owner_id: string; slug: string };
  const parsed = await readBoundedJson(c.req.raw);
  if (parsed.error) return c.json({ error: parsed.error }, parsed.status);
  const body = parsed.value as any;

  const items = Array.isArray(body) ? body : Array.isArray(body?.receipts) ? body.receipts : [body];
  if (items.length === 0) return c.json({ error: 'no receipts provided' }, 400);
  if (items.length > MAX_BATCH) {
    return c.json({ error: `batch too large: max ${MAX_BATCH}` }, 400);
  }

  const normalized: NormalizedReceipt[] = [];
  for (let i = 0; i < items.length; i++) {
    const result = normalizeReceipt(items[i]);
    if ('error' in result) return c.json({ error: `receipt[${i}]: ${result.error}` }, 400);
    // API-key scope: project_id must match this project's slug or id
    if (result.project_id !== project.slug && result.project_id !== project.id) {
      return c.json(
        { error: `receipt[${i}]: project_id outside authenticated project scope` },
        403
      );
    }
    normalized.push(result);
  }

  let accepted = 0;
  let deduped = 0;
  const ids: string[] = [];
  for (const receipt of normalized) {
    const status = await insertReceipt(c.env.DB, project.owner_id, receipt);
    if (status === 'accepted') {
      accepted += 1;
      ids.push(receipt.idempotency_key);
    } else {
      deduped += 1;
    }
  }

  return c.json({ accepted, deduped, capped: 0, received: normalized.length, ids }, 201);
});

ingest.post('/spans', async (c) => {
  const project = c.get('project') as { id: string; owner_id: string; slug: string };
  const parsed = await readBoundedJson(c.req.raw);
  if (parsed.error) return c.json({ error: parsed.error }, parsed.status);
  const body = parsed.value as any;

  const items = Array.isArray(body) ? body : Array.isArray(body?.spans) ? body.spans : [body];
  if (items.length === 0) return c.json({ error: 'no spans provided' }, 400);
  if (items.length > MAX_BATCH) {
    return c.json({ error: `batch too large: max ${MAX_BATCH}` }, 400);
  }

  const normalized: NormalizedSpan[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const scopedItem =
      item && typeof item === 'object' && !Array.isArray(item) && item.project_id == null
        ? { ...item, project_id: project.slug }
        : item;
    const result = normalizeSpan(scopedItem);
    if ('error' in result) return c.json({ error: `span[${i}]: ${result.error}` }, 400);
    if (result.project_id !== project.slug && result.project_id !== project.id) {
      return c.json({ error: `span[${i}]: project_id outside authenticated project scope` }, 403);
    }
    normalized.push({ ...result, project_id: project.slug });
  }

  let accepted = 0;
  let deduped = 0;
  let capped = 0;
  const ids: string[] = [];
  for (const span of normalized) {
    const status = await insertSpan(c.env.DB, project.owner_id, span);
    if (status === 'accepted') {
      accepted += 1;
      ids.push(span.idempotency_key);
    } else if (status === 'deduped') {
      deduped += 1;
    } else {
      capped += 1;
    }
  }

  return c.json({ accepted, deduped, capped, received: normalized.length, ids }, 201);
});

// --- Private queries (session) -------------------------------------------------

const query = new Hono<{ Bindings: Bindings; Variables: Variables }>();
query.use('/summary', requireSession);
query.use('/spans/recent', requireSession);
query.use('/routes', requireSession);
query.use('/traces/*', requireSession);
query.use('/volume', requireSession);
query.use('/cleanup', requireSession);
query.use('/budgets', requireSession);
query.use('/budgets/approve', requireSession);

function filterClause(params: {
  project_id?: string | null;
  surface?: string | null;
  environment?: string | null;
  source?: string | null;
  since?: string | null;
  until?: string | null;
  timeColumn: string;
}): { sql: string; values: unknown[] } {
  const conditions: string[] = ['owner_id = ?'];
  const values: unknown[] = [];
  // owner bound by caller
  if (params.project_id) {
    conditions.push('project_id = ?');
    values.push(params.project_id);
  }
  if (params.surface) {
    conditions.push('surface = ?');
    values.push(params.surface);
  }
  if (params.environment) {
    conditions.push('environment = ?');
    values.push(params.environment);
  }
  if (params.source) {
    conditions.push('source = ?');
    values.push(params.source);
  }
  if (params.since) {
    conditions.push(`${params.timeColumn} >= ?`);
    values.push(params.since);
  }
  if (params.until) {
    conditions.push(`${params.timeColumn} <= ?`);
    values.push(params.until);
  }
  return { sql: conditions.join(' AND '), values };
}

query.get('/summary', async (c) => {
  const userId = c.get('userId')!;
  const project_id = c.req.query('project_id') ?? null;
  const environment = c.req.query('environment') ?? null;
  const source = c.req.query('source') ?? null;
  const since = c.req.query('since') ?? null;
  const limit = parseLimit(c.req.query('limit'), 100, 500);

  const { sql, values } = filterClause({
    project_id,
    environment,
    source,
    since,
    timeColumn: 'window_end',
  });
  const { results } = await c.env.DB.prepare(
    `SELECT id, project_id, kind, surface, environment, source, revision,
            window_start, window_end, sample_count, error_count, sampling_rate,
            probe_mode, probe_origin, method, route_template, latency_json, phases_json,
            web_vitals_json, diagnostic_ref, ingested_at
     FROM performance_rollups
     WHERE ${sql.replace('owner_id = ?', 'owner_id = ?')}
     ORDER BY window_end DESC
     LIMIT ?`
  )
    .bind(userId, ...values, limit)
    .all();

  const data = (results ?? []).map((row) => ({
    ...row,
    latency_ms: row.latency_json ? JSON.parse(String(row.latency_json)) : null,
    phases: row.phases_json ? JSON.parse(String(row.phases_json)) : null,
    web_vitals: row.web_vitals_json ? JSON.parse(String(row.web_vitals_json)) : null,
    latency_json: undefined,
    phases_json: undefined,
    web_vitals_json: undefined,
  }));

  return c.json({ data });
});

query.get('/spans/recent', async (c) => {
  const userId = c.get('userId')!;
  const project_id = c.req.query('project_id') ?? null;
  const source = c.req.query('source') ?? null;
  const since = c.req.query('since') ?? null;
  const limit = parseLimit(c.req.query('limit'), 50, 200);

  const { sql, values } = filterClause({
    project_id,
    source,
    since,
    timeColumn: 'observed_at',
  });

  const { results } = await c.env.DB.prepare(
    `SELECT id, project_id, surface, environment, source, revision, observed_at,
            trace_id, method, route_template, status_class, duration_ms, ttfb_ms,
            probe_mode, sampling_rate, ingested_at
     FROM performance_spans
     WHERE ${sql}
     ORDER BY observed_at DESC
     LIMIT ?`
  )
    .bind(userId, ...values, limit)
    .all();

  return c.json({ data: results ?? [] });
});

query.get('/routes', async (c) => {
  const userId = c.get('userId')!;
  const project_id = c.req.query('project_id') ?? null;
  const source = c.req.query('source') ?? null;
  const since = c.req.query('since') ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const order = c.req.query('order') ?? 'volume'; // volume | slow | error
  const percentileKey = c.req.query('percentile') ?? 'p95';
  const limit = parseLimit(c.req.query('limit'), 25, 100);

  const { sql, values } = filterClause({
    project_id,
    source,
    since,
    timeColumn: 'observed_at',
  });

  const { results } = await c.env.DB.prepare(
    `SELECT project_id, surface, environment, source, method, route_template,
            duration_ms, status_class, sampling_rate, observed_at
     FROM performance_spans
     WHERE ${sql}
     ORDER BY observed_at DESC
     LIMIT ?`
  )
    .bind(userId, ...values, MAX_QUERY_ROWS)
    .all();

  type Agg = {
    project_id: string;
    surface: string;
    environment: string;
    source: string;
    method: string;
    route_template: string;
    durations: number[];
    sample_count: number;
    error_count: number;
    sampling_rates: number[];
    last_seen: string | null;
  };

  const map = new Map<string, Agg>();
  for (const row of results ?? []) {
    const key = [
      row.project_id,
      row.surface,
      row.environment,
      row.source,
      row.method,
      row.route_template,
    ].join('|');
    let agg = map.get(key);
    if (!agg) {
      agg = {
        project_id: String(row.project_id),
        surface: String(row.surface),
        environment: String(row.environment),
        source: String(row.source),
        method: String(row.method),
        route_template: String(row.route_template),
        durations: [],
        sample_count: 0,
        error_count: 0,
        sampling_rates: [],
        last_seen: null,
      };
      map.set(key, agg);
    }
    agg.sample_count += 1;
    const duration = Number(row.duration_ms);
    if (Number.isFinite(duration)) agg.durations.push(duration);
    const status = String(row.status_class);
    if (status === '5xx' || status === '4xx') agg.error_count += 1;
    if (row.sampling_rate != null && Number.isFinite(Number(row.sampling_rate))) {
      agg.sampling_rates.push(Number(row.sampling_rate));
    }
    const observedAt = typeof row.observed_at === 'string' ? row.observed_at : null;
    if (observedAt && (!agg.last_seen || Date.parse(observedAt) > Date.parse(agg.last_seen))) {
      agg.last_seen = observedAt;
    }
  }

  const pNum = Number(String(percentileKey).replace(/^p/i, '')) || 95;
  if (![50, 75, 95, 99].includes(pNum)) {
    return c.json({ error: 'percentile must be p50, p75, p95, or p99' }, 400);
  }
  const ranked = [...map.values()].map((agg) => ({
    project_id: agg.project_id,
    surface: agg.surface,
    environment: agg.environment,
    source: agg.source,
    method: agg.method,
    route_template: agg.route_template,
    sample_count: agg.sample_count,
    error_count: agg.error_count,
    error_rate: agg.sample_count === 0 ? 0 : agg.error_count / agg.sample_count,
    sampling_rate:
      agg.sampling_rates.length === 0
        ? null
        : agg.sampling_rates.reduce((a, b) => a + b, 0) / agg.sampling_rates.length,
    last_seen: agg.last_seen,
    latency_ms: {
      p50: percentile(agg.durations, 50),
      p75: percentile(agg.durations, 75),
      p95: percentile(agg.durations, 95),
      p99: percentile(agg.durations, 99),
    },
    _sort:
      order === 'slow'
        ? (percentile(agg.durations, pNum) ?? -1)
        : order === 'error'
          ? agg.error_count / Math.max(agg.sample_count, 1)
          : agg.sample_count,
  }));

  ranked.sort((a, b) => b._sort - a._sort);
  const data = ranked.slice(0, limit).map(({ _sort, ...rest }) => rest);

  return c.json({
    data,
    order,
    percentile: `p${pNum}`,
    sampled_rows: results?.length ?? 0,
    truncated: (results?.length ?? 0) === MAX_QUERY_ROWS,
  });
});

query.get('/traces/:traceId', async (c) => {
  const userId = c.get('userId')!;
  const traceId = c.req.param('traceId');
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(traceId)) {
    return c.json({ error: 'invalid trace id' }, 400);
  }

  const { results: spans } = await c.env.DB.prepare(
    `SELECT id, project_id, surface, environment, source, revision, observed_at,
            trace_id, method, route_template, status_class, duration_ms, ttfb_ms,
            probe_mode, sampling_rate, ingested_at
     FROM performance_spans
     WHERE owner_id = ? AND trace_id = ?
     ORDER BY observed_at ASC`
  )
    .bind(userId, traceId)
    .all();

  const { results: operations } = await c.env.DB.prepare(
    `SELECT id, project_id, span_id, trace_id, kind, label, fingerprint,
            duration_ms, success, observed_at, ingested_at
     FROM performance_operations
     WHERE owner_id = ? AND trace_id = ?
     ORDER BY observed_at ASC`
  )
    .bind(userId, traceId)
    .all();

  return c.json({
    spans: spans ?? [],
    operations: (operations ?? []).map((op) => ({
      ...op,
      success: Boolean(op.success),
    })),
  });
});

query.get('/volume', async (c) => {
  const userId = c.get('userId')!;
  const days = parseLimit(c.req.query('days'), 14, 90);

  const { results: rollupBuckets } = await c.env.DB.prepare(
    `SELECT date(window_end) AS day, project_id, source, COUNT(*) AS records
     FROM performance_rollups
     WHERE owner_id = ? AND window_end >= datetime('now', ?)
     GROUP BY day, project_id, source
     ORDER BY day DESC`
  )
    .bind(userId, `-${days} days`)
    .all();

  const { results: spanBuckets } = await c.env.DB.prepare(
    `SELECT date(observed_at) AS day, project_id, source, COUNT(*) AS records
     FROM performance_spans
     WHERE owner_id = ? AND observed_at >= datetime('now', ?)
     GROUP BY day, project_id, source
     ORDER BY day DESC`
  )
    .bind(userId, `-${days} days`)
    .all();

  const latestCleanup = await c.env.DB.prepare(
    `SELECT id AS run_id, span_cutoff, rollup_cutoff, spans_deleted, operations_deleted,
            rollups_deleted, bounded, created_at
     FROM performance_cleanup_runs
     WHERE owner_id = ?
     ORDER BY created_at DESC
     LIMIT 1`
  )
    .bind(userId)
    .first();

  const buckets = [
    ...(rollupBuckets ?? []).map((b) => ({
      day: b.day,
      project_id: b.project_id,
      source: b.source,
      kind: 'receipt' as const,
      records: Number(b.records),
      approximate_bytes: Number(b.records) * 512,
    })),
    ...(spanBuckets ?? []).map((b) => ({
      day: b.day,
      project_id: b.project_id,
      source: b.source,
      kind: 'span' as const,
      records: Number(b.records),
      approximate_bytes: Number(b.records) * 256,
    })),
  ];

  return c.json({
    retention: { spans_days: SPAN_RETENTION_DAYS, rollups_months: ROLLUP_RETENTION_MONTHS },
    days,
    buckets,
    latest_cleanup: latestCleanup ? { ...latestCleanup, bounded: true } : null,
  });
});

query.post('/cleanup', async (c) => {
  const userId = c.get('userId')!;
  const spanCutoff = new Date(Date.now() - SPAN_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const rollupCutoff = new Date(
    Date.now() - ROLLUP_RETENTION_MONTHS * 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Bound deletions so cleanup never blocks forever on a product request path.
  const expiredSpans = await c.env.DB.prepare(
    `SELECT id FROM performance_spans
     WHERE owner_id = ? AND observed_at < ?
     LIMIT ?`
  )
    .bind(userId, spanCutoff, CLEANUP_BATCH)
    .all<{ id: string }>();

  const spanIds = (expiredSpans.results ?? []).map((r) => r.id);
  let operationsDeleted = 0;
  let spansDeleted = 0;

  if (spanIds.length > 0) {
    const placeholders = spanIds.map(() => '?').join(',');
    const opResult = await c.env.DB.prepare(
      `DELETE FROM performance_operations
       WHERE owner_id = ? AND span_id IN (${placeholders})`
    )
      .bind(userId, ...spanIds)
      .run();
    operationsDeleted = opResult.meta?.changes ?? 0;

    const spanResult = await c.env.DB.prepare(
      `DELETE FROM performance_spans
       WHERE owner_id = ? AND id IN (${placeholders})`
    )
      .bind(userId, ...spanIds)
      .run();
    spansDeleted = spanResult.meta?.changes ?? 0;
  }

  const rollupResult = await c.env.DB.prepare(
    `DELETE FROM performance_rollups
     WHERE owner_id = ? AND window_end < ?
     AND id IN (
       SELECT id FROM performance_rollups
       WHERE owner_id = ? AND window_end < ?
       LIMIT ?
     )`
  )
    .bind(userId, rollupCutoff, userId, rollupCutoff, CLEANUP_BATCH)
    .run();
  const rollupsDeleted = rollupResult.meta?.changes ?? 0;

  const runId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO performance_cleanup_runs (
      id, owner_id, span_cutoff, rollup_cutoff, spans_deleted, operations_deleted, rollups_deleted, bounded
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
  )
    .bind(runId, userId, spanCutoff, rollupCutoff, spansDeleted, operationsDeleted, rollupsDeleted)
    .run();

  return c.json({
    run_id: runId,
    span_cutoff: spanCutoff,
    rollup_cutoff: rollupCutoff,
    spans_deleted: spansDeleted,
    operations_deleted: operationsDeleted,
    rollups_deleted: rollupsDeleted,
    bounded: true as const,
  });
});

query.get('/budgets', async (c) => {
  const userId = c.get('userId')!;
  const project_id = c.req.query('project_id') ?? null;
  if (project_id) {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM performance_surface_budgets WHERE owner_id = ? AND project_id = ?`
    )
      .bind(userId, project_id)
      .all();
    return c.json({ data: results ?? [] });
  }
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM performance_surface_budgets WHERE owner_id = ?`
  )
    .bind(userId)
    .all();
  return c.json({ data: results ?? [] });
});

query.post('/budgets/approve', async (c) => {
  const userId = c.get('userId')!;
  const parsed = await readBoundedJson(c.req.raw);
  if (parsed.error) return c.json({ error: parsed.error }, parsed.status);
  const body = parsed.value as any;
  if (!body || typeof body !== 'object') return c.json({ error: 'invalid JSON body' }, 400);

  const project_id = typeof body.project_id === 'string' ? body.project_id.trim() : '';
  const surface = typeof body.surface === 'string' ? body.surface.trim() : '';
  const environment = typeof body.environment === 'string' ? body.environment.trim() : 'production';
  const mode = body.mode === 'alerting' || body.mode === 'enforcing' ? body.mode : 'alerting';
  if (!project_id || !surface) return c.json({ error: 'project_id and surface are required' }, 400);
  if (!/^[a-z0-9][a-z0-9._-]{0,159}$/.test(project_id)) {
    return c.json({ error: 'invalid project_id' }, 400);
  }
  if (!/^[a-z0-9][a-z0-9._-]{0,159}$/.test(surface)) {
    return c.json({ error: 'invalid surface' }, 400);
  }
  if (!['production', 'staging', 'preview', 'development', 'local'].includes(environment)) {
    return c.json({ error: 'invalid environment' }, 400);
  }

  const latencyP95 =
    typeof body.latency_p95_ms === 'number' &&
    Number.isFinite(body.latency_p95_ms) &&
    body.latency_p95_ms > 0 &&
    body.latency_p95_ms <= 600_000
      ? body.latency_p95_ms
      : null;
  const errorRate =
    typeof body.error_rate === 'number' &&
    Number.isFinite(body.error_rate) &&
    body.error_rate >= 0 &&
    body.error_rate <= 100
      ? body.error_rate
      : null;
  if (body.latency_p95_ms != null && latencyP95 === null) {
    return c.json({ error: 'latency_p95_ms must be between 0 and 600000' }, 400);
  }
  if (body.error_rate != null && errorRate === null) {
    return c.json({ error: 'error_rate must be between 0 and 100' }, 400);
  }

  // Observation-only default: never jump straight to enforcing without explicit mode.
  if (mode === 'enforcing') {
    return c.json(
      {
        error:
          'enforcing mode requires a separate owner approval after the 14-day observation window',
      },
      400
    );
  }

  const id = crypto.randomUUID();
  const approvedAt = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO performance_surface_budgets (
      id, owner_id, project_id, surface, environment, mode, latency_p95_ms, error_rate, approved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_id, project_id, surface, environment) DO UPDATE SET
      mode = excluded.mode,
      latency_p95_ms = excluded.latency_p95_ms,
      error_rate = excluded.error_rate,
      approved_at = excluded.approved_at,
      updated_at = datetime('now')`
  )
    .bind(id, userId, project_id, surface, environment, mode, latencyP95, errorRate, approvedAt)
    .run();

  return c.json({ ok: true, mode, approved_at: approvedAt });
});

// Mount
performanceRoutes.route('/', ingest);
performanceRoutes.route('/', query);

export { performanceRoutes };
