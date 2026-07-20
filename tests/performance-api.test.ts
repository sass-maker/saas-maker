import { beforeEach, describe, expect, it, vi } from 'vitest';

const PROJECT = { id: 'project-1', owner_id: 'owner-1', slug: 'project-one' };

type Context = {
  req: { header: (name: string) => string | undefined };
  set: (key: string, value: unknown) => void;
  json: (body: object, status: number) => Response;
};

vi.mock('../workers/api/src/middleware/auth', () => ({
  requireApiKey: async (c: Context, next: () => Promise<void>) => {
    if (c.req.header('X-Project-Key') !== 'pk_project_one') {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    c.set('projectId', PROJECT.id);
    c.set('project', PROJECT);
    await next();
  },
  requireSession: async (c: Context, next: () => Promise<void>) => {
    if (c.req.header('Authorization') !== 'Bearer owner-token') {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    c.set('userId', PROJECT.owner_id);
    await next();
  },
}));

import { performanceRoutes } from '../workers/api/src/routes/performance';

interface StoredRollup {
  id: string;
  owner_id: string;
  project_id: string;
  idempotency_key: string;
  kind: string;
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
  latency_json: string | null;
  phases_json: string | null;
  web_vitals_json: string | null;
  diagnostic_ref: string | null;
  ingested_at: string;
}

interface StoredSpan {
  id: string;
  owner_id: string;
  project_id: string;
  idempotency_key: string;
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
  ingested_at: string;
}

class FakeStatement {
  values: unknown[] = [];

  constructor(
    private readonly db: FakeD1,
    private readonly sql: string
  ) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async run() {
    const sql = this.sql.replace(/\s+/g, ' ').trim();
    if (sql.startsWith('INSERT INTO performance_rollups')) {
      const v = this.values;
      const duplicate = this.db.rollups.some(
        (row) => row.owner_id === v[1] && row.project_id === v[2] && row.idempotency_key === v[3]
      );
      if (duplicate) return { meta: { changes: 0 } };
      this.db.rollups.push({
        id: String(v[0]),
        owner_id: String(v[1]),
        project_id: String(v[2]),
        idempotency_key: String(v[3]),
        kind: String(v[4]),
        surface: String(v[5]),
        environment: String(v[6]),
        source: String(v[7]),
        revision: v[8] as string | null,
        window_start: String(v[9]),
        window_end: String(v[10]),
        sample_count: Number(v[11]),
        error_count: Number(v[12]),
        sampling_rate: v[13] as number | null,
        probe_mode: v[14] as string | null,
        method: v[16] as string | null,
        route_template: v[17] as string | null,
        latency_json: v[18] as string | null,
        phases_json: v[19] as string | null,
        web_vitals_json: v[20] as string | null,
        diagnostic_ref: v[21] as string | null,
        ingested_at: '2026-07-20T12:00:00.000Z',
      });
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('INSERT INTO performance_spans')) {
      const v = this.values;
      const duplicate = this.db.spans.some(
        (row) => row.owner_id === v[1] && row.project_id === v[2] && row.idempotency_key === v[3]
      );
      if (duplicate) return { meta: { changes: 0 } };
      const routeCount = this.db.spans.filter(
        (row) =>
          row.owner_id === v[17] &&
          row.project_id === v[18] &&
          row.route_template === v[19] &&
          row.observed_at >= String(v[20]) &&
          row.observed_at < String(v[21])
      ).length;
      if (routeCount >= Number(v[22])) return { meta: { changes: 0 } };
      this.db.spans.push({
        id: String(v[0]),
        owner_id: String(v[1]),
        project_id: String(v[2]),
        idempotency_key: String(v[3]),
        surface: String(v[4]),
        environment: String(v[5]),
        source: String(v[6]),
        revision: v[7] as string | null,
        observed_at: String(v[8]),
        trace_id: String(v[9]),
        method: String(v[10]),
        route_template: String(v[11]),
        status_class: String(v[12]),
        duration_ms: Number(v[13]),
        ttfb_ms: v[14] as number | null,
        probe_mode: v[15] as string | null,
        sampling_rate: v[16] as number | null,
        ingested_at: '2026-07-20T12:00:00.000Z',
      });
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('INSERT INTO performance_operations')) {
      const v = this.values;
      this.db.operations.push({
        id: String(v[0]),
        owner_id: String(v[1]),
        project_id: String(v[2]),
        span_id: String(v[3]),
        trace_id: String(v[4]),
        kind: String(v[5]),
        label: String(v[6]),
        fingerprint: String(v[7]),
        duration_ms: Number(v[8]),
        success: Number(v[9]),
        observed_at: String(v[10]),
        ingested_at: '2026-07-20T12:00:00.000Z',
      });
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('DELETE FROM performance_operations')) {
      const ids = new Set(this.values.slice(1).map(String));
      const before = this.db.operations.length;
      this.db.operations = this.db.operations.filter((row) => !ids.has(String(row.span_id)));
      return { meta: { changes: before - this.db.operations.length } };
    }
    if (sql.startsWith('DELETE FROM performance_spans')) {
      const ids = new Set(this.values.slice(1).map(String));
      const before = this.db.spans.length;
      this.db.spans = this.db.spans.filter((row) => !ids.has(row.id));
      return { meta: { changes: before - this.db.spans.length } };
    }
    if (sql.startsWith('DELETE FROM performance_rollups')) {
      const cutoff = String(this.values[1]);
      const before = this.db.rollups.length;
      this.db.rollups = this.db.rollups.filter((row) => row.window_end >= cutoff);
      return { meta: { changes: before - this.db.rollups.length } };
    }
    if (sql.startsWith('INSERT INTO performance_cleanup_runs')) {
      this.db.cleanupRuns.push({ run_id: this.values[0], span_cutoff: this.values[2] });
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('INSERT INTO performance_surface_budgets')) {
      return { meta: { changes: 1 } };
    }
    return { meta: { changes: 0 } };
  }

  async all<T = Record<string, unknown>>() {
    const sql = this.sql.replace(/\s+/g, ' ').trim();
    if (sql.includes('FROM performance_rollups') && sql.startsWith('SELECT id,')) {
      return { results: [...this.db.rollups].reverse() as T[] };
    }
    if (sql.startsWith('SELECT id FROM performance_spans')) {
      const cutoff = String(this.values[1]);
      return {
        results: this.db.spans
          .filter((row) => row.observed_at < cutoff)
          .map(({ id }) => ({ id })) as T[],
      };
    }
    if (sql.includes('FROM performance_spans')) {
      const traceId = sql.includes('trace_id = ?') ? String(this.values[1]) : null;
      const rows = traceId
        ? this.db.spans.filter((row) => row.trace_id === traceId)
        : this.db.spans;
      return { results: rows as T[] };
    }
    if (sql.includes('FROM performance_operations')) {
      const traceId = String(this.values[1]);
      return { results: this.db.operations.filter((row) => row.trace_id === traceId) as T[] };
    }
    if (sql.includes('GROUP BY day, project_id, source')) {
      return { results: [] as T[] };
    }
    if (sql.includes('FROM performance_surface_budgets')) return { results: [] as T[] };
    return { results: [] as T[] };
  }

  async first<T = Record<string, unknown>>() {
    const sql = this.sql.replace(/\s+/g, ' ').trim();
    if (sql.startsWith('SELECT 1 FROM performance_spans')) {
      const [ownerId, projectId, key] = this.values.map(String);
      return (
        this.db.spans.some(
          (row) =>
            row.owner_id === ownerId && row.project_id === projectId && row.idempotency_key === key
        )
          ? { present: 1 }
          : null
      ) as T | null;
    }
    if (sql.includes('FROM performance_cleanup_runs')) {
      return (this.db.cleanupRuns.at(-1) ?? null) as T | null;
    }
    return null;
  }
}

class FakeD1 {
  rollups: StoredRollup[] = [];
  spans: StoredSpan[] = [];
  operations: Array<Record<string, unknown>> = [];
  cleanupRuns: Array<Record<string, unknown>> = [];

  prepare(sql: string) {
    return new FakeStatement(this, sql);
  }

  async batch(statements: FakeStatement[]) {
    return Promise.all(statements.map((statement) => statement.run()));
  }
}

const RECEIPT = {
  schema_version: 1,
  idempotency_key: 'receipt-1',
  project_id: PROJECT.slug,
  kind: 'api',
  surface: 'project-one-api',
  environment: 'production',
  source: 'synthetic-api',
  window_start: '2026-07-20T10:00:00.000Z',
  window_end: '2026-07-20T11:00:00.000Z',
  sample_count: 20,
  error_count: 1,
  method: 'GET',
  route_template: '/health',
  latency_ms: { p50: 20, p75: 30, p95: 80, p99: 120 },
};

const SPAN = {
  schema_version: 1,
  idempotency_key: 'span-1',
  project_id: PROJECT.slug,
  surface: 'project-one-api',
  environment: 'production',
  source: 'server-runtime',
  observed_at: '2026-07-20T11:30:00.000Z',
  trace_id: 'tr_abcdef12',
  method: 'GET',
  route_template: '/v1/projects/:id',
  status_class: '2xx',
  duration_ms: 88,
  sampling_rate: 0.1,
  operations: [
    {
      kind: 'd1',
      label: 'projects.by-id',
      fingerprint: 'fp_abcdef12',
      duration_ms: 42,
      success: true,
    },
  ],
};

const KEY_ONLY_SPAN = Object.fromEntries(
  Object.entries(SPAN).filter(([key]) => key !== 'project_id')
);

function request(db: FakeD1, path: string, init?: RequestInit) {
  return performanceRoutes.request(path, init, { DB: db } as never);
}

function projectHeaders() {
  return { 'Content-Type': 'application/json', 'X-Project-Key': 'pk_project_one' };
}

function ownerHeaders() {
  return { Authorization: 'Bearer owner-token' };
}

let db: FakeD1;

beforeEach(() => {
  db = new FakeD1();
});

describe('performance evidence API', () => {
  it('derives project scope from the API key when the SDK omits project_id', async () => {
    const response = await request(db, '/spans', {
      method: 'POST',
      headers: projectHeaders(),
      body: JSON.stringify(KEY_ONLY_SPAN),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ accepted: 1, received: 1 });
    expect(db.spans[0]).toMatchObject({ project_id: PROJECT.slug });

    const explicitId = await request(db, '/spans', {
      method: 'POST',
      headers: projectHeaders(),
      body: JSON.stringify({
        ...SPAN,
        idempotency_key: 'explicit-project-id',
        project_id: PROJECT.id,
      }),
    });
    expect(explicitId.status).toBe(201);
    expect(db.spans[1]).toMatchObject({ project_id: PROJECT.slug });
  });

  it('keeps validation and project isolation after deriving key scope', async () => {
    const matching = await request(db, '/spans', {
      method: 'POST',
      headers: projectHeaders(),
      body: JSON.stringify(SPAN),
    });
    expect(matching.status).toBe(201);

    const mismatched = await request(db, '/spans', {
      method: 'POST',
      headers: projectHeaders(),
      body: JSON.stringify({ ...SPAN, idempotency_key: 'other-project', project_id: 'other' }),
    });
    expect(mismatched.status).toBe(403);

    const sensitive = await request(db, '/spans', {
      method: 'POST',
      headers: projectHeaders(),
      body: JSON.stringify({ ...KEY_ONLY_SPAN, idempotency_key: 'unsafe', headers: {} }),
    });
    expect(sensitive.status).toBe(400);
    expect(db.spans).toHaveLength(1);
  });

  it('requires authentication and rejects cross-project or sensitive evidence', async () => {
    expect((await request(db, '/summary')).status).toBe(401);
    const crossProject = await request(db, '/receipts', {
      method: 'POST',
      headers: projectHeaders(),
      body: JSON.stringify({ ...RECEIPT, project_id: 'other' }),
    });
    expect(crossProject.status).toBe(403);
    const sensitive = await request(db, '/spans', {
      method: 'POST',
      headers: projectHeaders(),
      body: JSON.stringify({ ...SPAN, authorization: 'secret' }),
    });
    expect(sensitive.status).toBe(400);
    const oversized = await request(db, '/spans', {
      method: 'POST',
      headers: projectHeaders(),
      body: JSON.stringify({ ...SPAN, extra: 'x'.repeat(257 * 1024) }),
    });
    expect(oversized.status).toBe(413);
  });

  it('deduplicates receipts and preserves source-specific summaries', async () => {
    for (const receipt of [
      RECEIPT,
      RECEIPT,
      { ...RECEIPT, idempotency_key: 'receipt-2', source: 'imported' },
    ]) {
      const response = await request(db, '/receipts', {
        method: 'POST',
        headers: projectHeaders(),
        body: JSON.stringify(receipt),
      });
      expect(response.status).toBe(201);
    }
    expect(db.rollups).toHaveLength(2);
    const response = await request(db, '/summary', { headers: ownerHeaders() });
    const body = (await response.json()) as { data: Array<{ source: string; latency_ms: object }> };
    expect(body.data.map((row) => row.source).sort()).toEqual(['imported', 'synthetic-api']);
    expect(body.data.every((row) => row.latency_ms)).toBe(true);
  });

  it('returns recent, aggregate, and sanitized trace-operation evidence', async () => {
    for (const span of [
      SPAN,
      { ...SPAN, idempotency_key: 'span-2', status_class: '5xx', duration_ms: 180 },
    ]) {
      const response = await request(db, '/spans', {
        method: 'POST',
        headers: projectHeaders(),
        body: JSON.stringify(span),
      });
      expect(response.status).toBe(201);
    }
    const routes = await request(db, '/routes?since=2026-07-20T00%3A00%3A00.000Z', {
      headers: ownerHeaders(),
    });
    expect(await routes.json()).toMatchObject({
      data: [
        {
          route_template: '/v1/projects/:id',
          sample_count: 2,
          error_count: 1,
          last_seen: SPAN.observed_at,
        },
      ],
    });
    const recent = await request(db, '/spans/recent', { headers: ownerHeaders() });
    const recentBody = (await recent.json()) as { data: Array<{ trace_id: string }> };
    expect(recentBody.data[0]?.trace_id).toBe(SPAN.trace_id);
    const trace = await request(db, `/traces/${SPAN.trace_id}`, { headers: ownerHeaders() });
    const traceBody = (await trace.json()) as {
      operations: Array<{ label: string; fingerprint: string }>;
    };
    expect(traceBody.operations).toHaveLength(2);
    expect(traceBody.operations[0]).toMatchObject({
      label: 'projects.by-id',
      fingerprint: 'fp_abcdef12',
    });
  });

  it('caps each route to 120 accepted spans per observed minute', async () => {
    let capped = 0;
    for (let batch = 0; batch < 3; batch += 1) {
      const spans = Array.from({ length: 50 }, (_, index) => ({
        ...SPAN,
        idempotency_key: `cap-${batch}-${index}`,
        trace_id: `tr_cap${batch}${String(index).padStart(4, '0')}`,
      }));
      const response = await request(db, '/spans', {
        method: 'POST',
        headers: projectHeaders(),
        body: JSON.stringify(spans),
      });
      expect(response.status).toBe(201);
      capped += ((await response.json()) as { capped: number }).capped;
    }
    expect(db.spans).toHaveLength(120);
    expect(capped).toBe(30);
  });

  it('runs explicit bounded retention cleanup and reports its policy', async () => {
    db.spans.push({
      id: 'old-span',
      owner_id: PROJECT.owner_id,
      project_id: PROJECT.slug,
      idempotency_key: 'old',
      surface: 'project-one-api',
      environment: 'production',
      source: 'server-runtime',
      revision: null,
      observed_at: '2020-01-01T00:00:00.000Z',
      trace_id: 'tr_old12345',
      method: 'GET',
      route_template: '/health',
      status_class: '2xx',
      duration_ms: 10,
      ttfb_ms: null,
      probe_mode: null,
      sampling_rate: 0.1,
      ingested_at: '2020-01-01T00:00:00.000Z',
    });
    const cleanup = await request(db, '/cleanup', { method: 'POST', headers: ownerHeaders() });
    expect(await cleanup.json()).toMatchObject({ bounded: true, spans_deleted: 1 });
    const volume = await request(db, '/volume?days=7', { headers: ownerHeaders() });
    expect(await volume.json()).toMatchObject({
      retention: { spans_days: 7, rollups_months: 13 },
      days: 7,
    });
  });
});
