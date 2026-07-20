import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeReceipt,
  normalizeSpan,
  PROHIBITED_KEYS,
} from '../workers/api/src/lib/performance-validate.ts';

describe('performance validation', () => {
  const baseReceipt = {
    schema_version: 1,
    idempotency_key: 'r1',
    project_id: 'sass-maker',
    kind: 'api',
    surface: 'sass-maker-api',
    environment: 'production',
    source: 'synthetic-api',
    window_start: '2026-07-20T00:00:00.000Z',
    window_end: '2026-07-20T00:05:00.000Z',
    sample_count: 20,
    method: 'GET',
    route_template: '/health',
    latency_ms: { p50: 10, p75: 12, p95: 20, p99: 40 },
  };

  it('accepts a valid synthetic receipt', () => {
    const result = normalizeReceipt(baseReceipt);
    assert.equal('error' in result, false);
    assert.equal(result.project_id, 'sass-maker');
    assert.equal(result.sample_count, 20);
  });

  it('rejects mutating synthetic methods', () => {
    const result = normalizeReceipt({ ...baseReceipt, method: 'POST' });
    assert.deepEqual(result, { error: 'synthetic-api receipts may only use GET or HEAD' });
  });

  it('rejects high-cardinality probe origins', () => {
    const result = normalizeReceipt({
      ...baseReceipt,
      probe_origin: 'host/user@example.com',
    });
    assert.equal('error' in result, true);
  });

  it('rejects query strings in routes', () => {
    const result = normalizeReceipt({
      ...baseReceipt,
      route_template: '/v1/items?token=secret',
    });
    assert.equal('error' in result, true);
  });

  it('rejects prohibited sensitive fields', () => {
    const result = normalizeReceipt({
      ...baseReceipt,
      authorization: 'Bearer x',
    });
    assert.deepEqual(result, { error: 'prohibited field: authorization' });
    assert.equal(PROHIBITED_KEYS.has('payload'), true);
  });

  it('rejects high-cardinality route templates', () => {
    const result = normalizeSpan({
      schema_version: 1,
      idempotency_key: 's1',
      project_id: 'sass-maker',
      surface: 'sass-maker-api',
      environment: 'production',
      source: 'server-runtime',
      observed_at: '2026-07-20T00:00:00.000Z',
      trace_id: 'tr_abc',
      method: 'GET',
      route_template: '/v1/items/12345678',
      status_class: '2xx',
      duration_ms: 12,
    });
    assert.equal('error' in result, true);
  });

  it('rejects raw SQL-looking operation labels', () => {
    const result = normalizeSpan({
      schema_version: 1,
      idempotency_key: 's2',
      project_id: 'sass-maker',
      surface: 'sass-maker-api',
      environment: 'production',
      source: 'server-runtime',
      observed_at: '2026-07-20T00:00:00.000Z',
      trace_id: 'tr_def',
      method: 'GET',
      route_template: '/v1/projects',
      status_class: '2xx',
      duration_ms: 40,
      operations: [
        {
          kind: 'sql',
          label: 'SELECT * FROM users',
          fingerprint: 'bad',
          duration_ms: 10,
          success: true,
        },
      ],
    });
    assert.equal('error' in result, true);
  });

  it('accepts sanitized spans with downstream ops', () => {
    const result = normalizeSpan({
      schema_version: 1,
      idempotency_key: 's3',
      project_id: 'sass-maker',
      surface: 'sass-maker-api',
      environment: 'production',
      source: 'server-runtime',
      observed_at: '2026-07-20T00:00:00.000Z',
      trace_id: 'tr_ok',
      method: 'GET',
      route_template: '/v1/projects',
      status_class: '2xx',
      duration_ms: 40,
      operations: [
        {
          kind: 'd1',
          label: 'projects.list',
          fingerprint: 'fp_abcdef12',
          duration_ms: 12,
          success: true,
        },
      ],
    });
    assert.equal('error' in result, false);
  });
});
