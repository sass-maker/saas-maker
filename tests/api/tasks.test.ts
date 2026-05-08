import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  listTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  createSymphonyAuditEvent: vi.fn(),
  listSymphonyAuditEvents: vi.fn(),
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
  mockDb.createTask.mockReset();
  mockDb.createTask.mockImplementation(async (_ownerId: string, input: any) => ({
    id: 'task-1',
    owner_id: 'user-1',
    project_slug: input.project_slug ?? null,
    title: input.title,
    description: input.description ?? null,
    status: 'todo',
    priority: input.priority ?? 'medium',
    task_type: input.task_type ?? 'feature',
    size: input.size ?? 'm',
    dependencies: input.dependencies ?? [],
    created_at: '2026-05-02 00:00:00',
    updated_at: '2026-05-02 00:00:00',
  }));
  mockDb.updateTask.mockReset();
  mockDb.updateTask.mockImplementation(async (id: string, ownerId: string, input: any) => ({
    id,
    owner_id: ownerId,
    project_slug: input.project_slug ?? 'saas-maker',
    title: input.title ?? 'Task',
    description: input.description ?? null,
    status: input.status ?? 'todo',
    priority: input.priority ?? 'medium',
    task_type: input.task_type ?? 'feature',
    size: input.size ?? 'm',
    dependencies: input.dependencies ?? [],
    created_at: '2026-05-02 00:00:00',
    updated_at: '2026-05-02 00:00:00',
  }));
  mockDb.deleteTask.mockReset();
  mockDb.deleteTask.mockResolvedValue(true);
  mockDb.createSymphonyAuditEvent.mockReset();
  mockDb.createSymphonyAuditEvent.mockImplementation(async (owner_id: string, input: any) => ({
    id: 'audit-1',
    owner_id,
    task_id: input.task_id ?? null,
    action: input.action,
    actor_source: input.actor_source ?? 'api',
    agent_profile: input.agent_profile ?? null,
    project_slug: input.project_slug ?? null,
    metadata: JSON.stringify(input.metadata ?? {}),
    created_at: '2026-05-02 00:00:00',
  }));
  mockDb.listSymphonyAuditEvents.mockReset();
  mockDb.listSymphonyAuditEvents.mockResolvedValue([]);
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

  it('POST /v1/tasks records an audit event', async () => {
    const res = await request('/v1/tasks', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-session', 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Audit me', project_slug: 'saas-maker', priority: 'high' }),
    });

    expect(res.status).toBe(201);
    expect(mockDb.createSymphonyAuditEvent).toHaveBeenCalledWith('user-1', expect.objectContaining({
      task_id: 'task-1',
      action: 'task_created',
      actor_source: 'api',
      project_slug: 'saas-maker',
    }));
  });

  it('POST /v1/tasks accepts dependency ids', async () => {
    const res = await request('/v1/tasks', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-session', 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Blocked task', dependencies: ['prereq-1', 'prereq-2', '', 'prereq-1'] }),
    });

    expect(res.status).toBe(201);
    expect(mockDb.createTask).toHaveBeenCalledWith('user-1', expect.objectContaining({
      title: 'Blocked task',
      dependencies: ['prereq-1', 'prereq-2'],
    }));
    const body = await res.json() as { data: { dependencies: string[] } };
    expect(body.data.dependencies).toEqual(['prereq-1', 'prereq-2']);
  });

  it('POST /v1/tasks omits dependencies when missing', async () => {
    const res = await request('/v1/tasks', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-session', 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Plain task' }),
    });

    expect(res.status).toBe(201);
    expect(mockDb.createTask).toHaveBeenCalledWith('user-1', expect.objectContaining({
      title: 'Plain task',
      dependencies: undefined,
    }));
  });

  it('PATCH /v1/tasks/:id forwards dependencies when provided', async () => {
    const res = await request('/v1/tasks/task-1', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer test-session', 'Content-Type': 'application/json' },
      body: JSON.stringify({ dependencies: ['prereq-1'] }),
    });

    expect(res.status).toBe(200);
    expect(mockDb.updateTask).toHaveBeenCalledWith('task-1', 'user-1', expect.objectContaining({
      dependencies: ['prereq-1'],
    }));
  });

  it('PATCH /v1/tasks/:id leaves dependencies untouched when omitted', async () => {
    const res = await request('/v1/tasks/task-1', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer test-session', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    });

    expect(res.status).toBe(200);
    const lastCall = mockDb.updateTask.mock.calls.at(-1)![2] as Record<string, unknown>;
    expect(lastCall).not.toHaveProperty('dependencies');
  });

  it('PATCH /v1/tasks/:id records status audit events', async () => {
    const res = await request('/v1/tasks/task-1', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer test-session', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });

    expect(res.status).toBe(200);
    expect(mockDb.createSymphonyAuditEvent).toHaveBeenCalledWith('user-1', expect.objectContaining({
      task_id: 'task-1',
      action: 'task_status_updated',
      metadata: expect.objectContaining({ status: 'in_progress' }),
    }));
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

describe('Symphony audit API', () => {
  it('GET /v1/symphony/audit lists audit events', async () => {
    const res = await request('/v1/symphony/audit?task_id=task-1&limit=10', {
      headers: { Authorization: 'Bearer test-session' },
    });

    expect(res.status).toBe(200);
    expect(mockDb.listSymphonyAuditEvents).toHaveBeenCalledWith('user-1', { task_id: 'task-1', limit: 10 });
  });

  it('POST /v1/symphony/audit records local CLI events', async () => {
    const res = await request('/v1/symphony/audit', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-session', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: 'task-1',
        action: 'task_dispatched',
        actor_source: 'local-cli',
        agent_profile: 'claude',
        project_slug: 'saas-maker',
      }),
    });

    expect(res.status).toBe(201);
    expect(mockDb.createSymphonyAuditEvent).toHaveBeenCalledWith('user-1', expect.objectContaining({
      task_id: 'task-1',
      action: 'task_dispatched',
      actor_source: 'local-cli',
      agent_profile: 'claude',
    }));
  });
});
