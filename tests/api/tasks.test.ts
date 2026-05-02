import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  listTasks: vi.fn(),
  getSymphonyMemory: vi.fn(),
  upsertSymphonyMemory: vi.fn(),
}));

type MockContext = {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
};

vi.mock('../../workers/api/src/db', () => ({
  getDb: () => mockDb,
}));

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

vi.mock('@saas-maker/ops', () => ({
  configurePostHog: vi.fn(),
  capture: vi.fn(),
  flushPostHog: vi.fn(),
}));

import { request } from './helpers';

beforeEach(() => {
  mockDb.listTasks.mockReset();
  mockDb.listTasks.mockResolvedValue([]);
  mockDb.getSymphonyMemory.mockReset();
  mockDb.getSymphonyMemory.mockResolvedValue(null);
  mockDb.upsertSymphonyMemory.mockReset();
  mockDb.upsertSymphonyMemory.mockImplementation(async (owner_id: string, content: string) => ({
    owner_id,
    content,
    updated_at: '2026-05-02 00:00:00',
  }));
});

describe('Tasks API', () => {
  it('GET /v1/tasks forwards status and project filters', async () => {
    const res = await request('/v1/tasks?status=todo&project_slug=free-ai', {
      headers: { Authorization: 'Bearer test-session' },
    });

    expect(res.status).toBe(200);
    expect(mockDb.listTasks).toHaveBeenCalledWith('user-1', 'todo', 'free-ai');
  });
});

describe('Symphony memory API', () => {
  it('GET /v1/symphony/memory returns empty memory by default', async () => {
    const res = await request('/v1/symphony/memory', {
      headers: { Authorization: 'Bearer test-session' },
    });

    expect(res.status).toBe(200);
    expect(mockDb.getSymphonyMemory).toHaveBeenCalledWith('user-1');
    await expect(res.json()).resolves.toEqual({
      data: {
        owner_id: 'user-1',
        content: '',
        updated_at: null,
      },
    });
  });

  it('PUT /v1/symphony/memory upserts user memory', async () => {
    const res = await request('/v1/symphony/memory', {
      method: 'PUT',
      headers: { Authorization: 'Bearer test-session', 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Prefer Gemini for bounded cheap asks.' }),
    });

    expect(res.status).toBe(200);
    expect(mockDb.upsertSymphonyMemory).toHaveBeenCalledWith('user-1', 'Prefer Gemini for bounded cheap asks.');
    await expect(res.json()).resolves.toMatchObject({
      data: {
        owner_id: 'user-1',
        content: 'Prefer Gemini for bounded cheap asks.',
      },
    });
  });
});
