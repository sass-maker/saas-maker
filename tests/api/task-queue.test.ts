import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  claimNextTask: vi.fn(),
  completeTask: vi.fn(),
  failTask: vi.fn(),
  heartbeatTask: vi.fn(),
  getTask: vi.fn(),
  createTaskComment: vi.fn(),
  createSymphonyAuditEvent: vi.fn(),
}));

type MockContext = {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
};

vi.mock('../../workers/api/src/db', () => ({ getDb: () => mockDb }));

vi.mock('../../workers/api/src/middleware/auth', () => ({
  requireSession: async (c: MockContext, next: () => Promise<void>) => {
    c.set('userId', 'user-1');
    await next();
  },
  requireApiKey: async (_c: MockContext, next: () => Promise<void>) => { await next(); },
  requireApiKeyOrSession: async (c: MockContext, next: () => Promise<void>) => { c.set('userId', 'user-1'); await next(); },
  resolveBearerUserId: vi.fn().mockResolvedValue('user-1'),
}));

vi.mock('../../workers/api/src/lib/telemetry.js', () => ({ configurePostHog: vi.fn(), capture: vi.fn(), flushPostHog: vi.fn() }));

import { request } from './helpers';

beforeEach(() => {
  Object.values(mockDb).forEach((fn) => fn.mockReset());
  mockDb.createSymphonyAuditEvent.mockResolvedValue(undefined);
  mockDb.getTask.mockImplementation(async (id: string) => ({ id, status: 'done' }));
});

describe('task-queue worker endpoints', () => {
  it('claims the next task for a capability', async () => {
    mockDb.claimNextTask.mockResolvedValue({ id: 't1', capability: 'review', status: 'in_progress' });
    const res = await request('/v1/tasks/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ worker: 'codevetter@host', capability: 'review' }),
    }, { DB: {} });
    expect(res.status).toBe(200);
    expect((await res.json() as { data: { id: string } }).data.id).toBe('t1');
    expect(mockDb.claimNextTask).toHaveBeenCalledWith('user-1', expect.objectContaining({ worker: 'codevetter@host', capability: 'review' }));
  });

  it('returns 204 when the queue is empty', async () => {
    mockDb.claimNextTask.mockResolvedValue(null);
    const res = await request('/v1/tasks/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ worker: 'w1' }),
    }, { DB: {} });
    expect(res.status).toBe(204);
  });

  it('requires a worker id to claim', async () => {
    const res = await request('/v1/tasks/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ capability: 'review' }),
    }, { DB: {} });
    expect(res.status).toBe(400);
  });

  it('clamps lease_seconds into range', async () => {
    mockDb.claimNextTask.mockResolvedValue({ id: 't1' });
    await request('/v1/tasks/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ worker: 'w1', lease_seconds: 999999 }),
    }, { DB: {} });
    expect(mockDb.claimNextTask).toHaveBeenCalledWith('user-1', expect.objectContaining({ leaseSeconds: 3600 }));
  });

  it('completes a task held by the worker', async () => {
    mockDb.completeTask.mockResolvedValue(true);
    const res = await request('/v1/tasks/t1/complete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ worker: 'w1', result: 'looks good' }),
    }, { DB: {} });
    expect(res.status).toBe(200);
    expect(mockDb.createTaskComment).toHaveBeenCalledWith('user-1', 't1', expect.objectContaining({ author_type: 'agent', body: 'looks good' }));
  });

  it('409s completing a task not held by the worker', async () => {
    mockDb.completeTask.mockResolvedValue(false);
    const res = await request('/v1/tasks/t1/complete', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ worker: 'w1' }),
    }, { DB: {} });
    expect(res.status).toBe(409);
  });

  it('requeues on fail under max attempts, dead-letters past it', async () => {
    mockDb.failTask.mockResolvedValueOnce({ dead_letter: false, requeued: true, attempts: 1 });
    let res = await request('/v1/tasks/t1/fail', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ worker: 'w1', error: 'boom' }),
    }, { DB: {} });
    expect(res.status).toBe(200);
    expect((await res.json() as { outcome: { requeued: boolean } }).outcome.requeued).toBe(true);

    mockDb.failTask.mockResolvedValueOnce({ dead_letter: true, requeued: false, attempts: 3 });
    res = await request('/v1/tasks/t1/fail', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ worker: 'w1', error: 'boom' }),
    }, { DB: {} });
    expect((await res.json() as { outcome: { dead_letter: boolean } }).outcome.dead_letter).toBe(true);
  });

  it('extends the lease on heartbeat', async () => {
    mockDb.heartbeatTask.mockResolvedValue(true);
    const res = await request('/v1/tasks/t1/heartbeat', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ worker: 'w1' }),
    }, { DB: {} });
    expect(res.status).toBe(200);
  });
});
