import { describe, expect, it, vi } from 'vitest';

type MockContext = {
  set: (key: string, value: unknown) => void;
};

vi.mock('../../workers/api/src/middleware/auth', () => ({
  requireSession: async (c: MockContext, next: () => Promise<void>) => {
    c.set('userId', 'user-1');
    await next();
  },
  requireApiKey: async (_c: MockContext, next: () => Promise<void>) => {
    await next();
  },
  requireApiKeyOrSession: async (c: MockContext, next: () => Promise<void>) => {
    c.set('userId', 'user-1');
    await next();
  },
  resolveBearerUserId: vi.fn().mockResolvedValue('user-1'),
}));

vi.mock('../../workers/api/src/lib/telemetry.js', () => ({
  capture: vi.fn(),
}));

import { request } from './helpers';

// Mock D1 that honours the (owner_id, idempotency_key) uniqueness so we can
// assert idempotent batch inserts return the right accepted/deduped counts.
function createMockD1() {
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  function makeStatement(sql: string, values: unknown[]) {
    return {
      sql,
      values,
      run: async () => execInsert(sql, values),
      first: async () => rows.find((r) => r.id === values[0]) ?? null,
      all: async () => ({
        results: rows.filter((r) => r.owner_id === values[0]),
      }),
    };
  }
  function execInsert(sql: string, values: unknown[]) {
    if (sql.includes('INSERT INTO fleet_events')) {
      const key = `${values[1]}::${values[7]}`; // owner_id::idempotency_key
      if (seen.has(key)) return { meta: { changes: 0 } };
      seen.add(key);
      rows.push({ id: values[0], owner_id: values[1], product: values[2], type: values[4] });
      return { meta: { changes: 1 } };
    }
    return { meta: { changes: 0 } };
  }
  return {
    prepare: (sql: string) => ({ bind: (...values: unknown[]) => makeStatement(sql, values) }),
    batch: async (statements: Array<{ sql: string; values: unknown[] }>) =>
      Promise.all(statements.map((s) => execInsert(s.sql, s.values))),
  };
}

describe('fleet events API', () => {
  it('accepts a single event and reports accepted=1', async () => {
    const res = await request('/v1/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ product: 'reel-pipeline', type: 'reel.rendered', payload: { reel_id: 'r1' } }),
    }, { DB: createMockD1() });

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ accepted: 1, deduped: 0, received: 1 });
  });

  it('rejects an event missing required fields', async () => {
    const res = await request('/v1/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'reel.rendered' }),
    }, { DB: createMockD1() });

    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toContain('product is required');
  });

  it('dedupes a repeated idempotency_key within a batch', async () => {
    const db = createMockD1();
    const event = { product: 'psi-swarm', type: 'audit.completed', idempotency_key: 'dup-1', payload: {} };
    const res = await request('/v1/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify([event, event]),
    }, { DB: db });

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ accepted: 1, deduped: 1, received: 2 });
  });

  it('rejects an over-sized batch', async () => {
    const events = Array.from({ length: 101 }, (_, i) => ({ product: 'p', type: 't', idempotency_key: `k${i}` }));
    const res = await request('/v1/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(events),
    }, { DB: createMockD1() });

    expect(res.status).toBe(400);
  });

  it('lists events for the owner', async () => {
    const db = createMockD1();
    await request('/v1/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ product: 'taste', type: 'study.completed', idempotency_key: 'a1' }),
    }, { DB: db });

    const res = await request('/v1/events?product=taste', { method: 'GET' }, { DB: db });
    expect(res.status).toBe(200);
    const payload = await res.json() as { data: unknown[] };
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data.length).toBe(1);
  });
});
