import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  getTask: vi.fn(),
  getProjectBySlug: vi.fn(),
  hasChangelogEntryForTask: vi.fn(),
  createChangelogEntry: vi.fn(),
  getProjectById: vi.fn(),
  listPublishedChangelog: vi.fn(),
  listChangelogEntries: vi.fn(),
  getChangelogStats: vi.fn(),
  updateChangelogEntry: vi.fn(),
  deleteChangelogEntry: vi.fn(),
  listFleetDailyChangelog: vi.fn(),
  listProjectsByOwner: vi.fn(),
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
  requireApiKey: async (c: MockContext, next: () => Promise<void>) => {
    c.set('projectId', 'project-1');
    await next();
  },
  requireApiKeyOrSession: async (c: MockContext, next: () => Promise<void>) => {
    c.set('userId', 'user-1');
    await next();
  },
  resolveBearerUserId: vi.fn().mockResolvedValue('user-1'),
}));

vi.mock('@saas-maker/ops', () => ({
  capture: vi.fn(),
}));

import { request } from './helpers';

const baseTask = {
  id: 'task-uuid-1',
  owner_id: 'user-1',
  project_slug: 'saas-maker',
  title: 'Add dark mode',
  description: 'Implement dark mode across the app',
  status: 'done',
  priority: 'medium',
  task_type: 'feature',
  size: 'm',
  dependencies: [],
  branch_name: null,
  pr_url: null,
  pr_status: 'none',
  commit_sha: null,
  deployment_url: null,
  deployment_status: 'none',
  blocked_on_user: false,
  created_at: '2026-05-26 00:00:00',
  updated_at: '2026-05-26 00:00:00',
};

const baseProject = {
  id: 'project-1',
  name: 'SaaS Maker',
  slug: 'saas-maker',
  api_key: 'pk_test',
  owner_id: 'user-1',
  created_at: '2026-05-26 00:00:00',
};

const baseEntry = {
  id: 'entry-1',
  project_id: 'project-1',
  title: 'Add dark mode',
  content: 'Implement dark mode across the app',
  version: null,
  type: 'feature',
  published: false,
  published_at: null,
  source: 'symphony-cli',
  task_id: 'task-uuid-1',
  agent: null,
  evidence: null,
  created_at: '2026-05-26 00:00:00',
  updated_at: '2026-05-26 00:00:00',
};

beforeEach(() => {
  vi.resetAllMocks();
  mockDb.getTask.mockResolvedValue(baseTask);
  mockDb.getProjectBySlug.mockResolvedValue(baseProject);
  mockDb.hasChangelogEntryForTask.mockResolvedValue(false);
  mockDb.createChangelogEntry.mockResolvedValue(baseEntry);
  mockDb.getProjectById.mockResolvedValue(baseProject);
  mockDb.listPublishedChangelog.mockResolvedValue([]);
  mockDb.listChangelogEntries.mockResolvedValue({ data: [], total: 0 });
  mockDb.getChangelogStats.mockResolvedValue({ total: 0, published: 0, drafts: 0 });
  mockDb.listFleetDailyChangelog.mockResolvedValue([]);
  mockDb.listProjectsByOwner.mockResolvedValue([baseProject]);
});

describe('GET /v1/changelog/fleet/daily', () => {
  it('returns 200 with empty entries by default', async () => {
    const res = await request('/v1/changelog/fleet/daily');
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.entries).toEqual([]);
    expect(json.by_project).toEqual({});
    expect(json.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('passes the authenticated userId to db for owner-scoped filtering', async () => {
    await request('/v1/changelog/fleet/daily');
    expect(mockDb.listFleetDailyChangelog).toHaveBeenCalledWith('user-1', expect.any(String));
  });

  it('forwards an explicit date param to db and reflects it in the response', async () => {
    const res = await request('/v1/changelog/fleet/daily?date=2026-05-25');
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.date).toBe('2026-05-25');
    expect(mockDb.listFleetDailyChangelog).toHaveBeenCalledWith('user-1', '2026-05-25');
  });

  it('falls back to today when the date param is malformed', async () => {
    const res = await request('/v1/changelog/fleet/daily?date=not-a-date');
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(json.date).not.toBe('not-a-date');
  });

  it('groups returned entries by project_slug', async () => {
    const fleetEntries = [
      { ...baseEntry, id: 'e1', project_slug: 'alpha', project_name: 'Alpha' },
      { ...baseEntry, id: 'e2', project_slug: 'beta',  project_name: 'Beta'  },
      { ...baseEntry, id: 'e3', project_slug: 'alpha', project_name: 'Alpha' },
    ];
    mockDb.listFleetDailyChangelog.mockResolvedValue(fleetEntries);
    const res = await request('/v1/changelog/fleet/daily?date=2026-05-25');
    const json = await res.json() as any;
    expect(json.entries).toHaveLength(3);
    expect(Object.keys(json.by_project).sort()).toEqual(['alpha', 'beta']);
    expect(json.by_project['alpha']).toHaveLength(2);
    expect(json.by_project['beta']).toHaveLength(1);
  });

  it('late-UTC IST date reaches db correctly (regression: IST today hid late-UTC entries)', async () => {
    // Simulates: user in IST requests date=2026-05-26 (their local today),
    // which corresponds to entries created >= 18:30 UTC on 2026-05-25.
    // The Cockpit page passes the IST date; this test confirms the API
    // forwards it verbatim so the caller controls timezone semantics.
    const res = await request('/v1/changelog/fleet/daily?date=2026-05-26');
    expect(res.status).toBe(200);
    expect(mockDb.listFleetDailyChangelog).toHaveBeenCalledWith('user-1', '2026-05-26');
  });
});

describe('POST /v1/changelog/from-task', () => {
  it('creates a draft changelog entry for a feature task', async () => {
    const res = await request('/v1/changelog/from-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: 'task-uuid-1', source: 'symphony-cli' }),
    });
    expect(res.status).toBe(201);
    const json = await res.json() as any;
    expect(json.data).toBeDefined();
    expect(mockDb.createChangelogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Add dark mode',
        type: 'feature',
        source: 'symphony-cli',
        task_id: 'task-uuid-1',
        published: false,
        created_at: null,
        updated_at: null,
      })
    );
  });

  it('maps bug task_type to fix changelog type', async () => {
    mockDb.getTask.mockResolvedValue({ ...baseTask, task_type: 'bug', title: 'Fix crash on login' });
    const res = await request('/v1/changelog/from-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: 'task-uuid-1' }),
    });
    expect(res.status).toBe(201);
    expect(mockDb.createChangelogEntry).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'fix' })
    );
  });

  it('resolves canonical fleet slug to generated project slug', async () => {
    mockDb.getProjectBySlug.mockResolvedValue(null);
    mockDb.listProjectsByOwner.mockResolvedValue([
      { ...baseProject, slug: 'linkchat-modh35vp', name: 'linkchat' },
    ]);
    mockDb.getTask.mockResolvedValue({ ...baseTask, project_slug: 'linkchat' });

    const res = await request('/v1/changelog/from-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: 'task-uuid-1' }),
    });

    expect(res.status).toBe(201);
    expect(mockDb.createChangelogEntry).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: 'project-1', task_id: 'task-uuid-1' })
    );
  });

  it('resolves punctuation differences in project slugs', async () => {
    mockDb.getProjectBySlug.mockResolvedValue(null);
    mockDb.listProjectsByOwner.mockResolvedValue([
      { ...baseProject, slug: 'significanthobbies-modh1234', name: 'SignificantHobbies' },
    ]);
    mockDb.getTask.mockResolvedValue({ ...baseTask, project_slug: 'significant-hobbies' });

    const res = await request('/v1/changelog/from-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: 'task-uuid-1' }),
    });

    expect(res.status).toBe(201);
    expect(mockDb.createChangelogEntry).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: 'project-1', task_id: 'task-uuid-1' })
    );
  });

  it('skips infra task types (chore)', async () => {
    mockDb.getTask.mockResolvedValue({ ...baseTask, task_type: 'chore' });
    const res = await request('/v1/changelog/from-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: 'task-uuid-1' }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.skipped).toBe(true);
    expect(json.reason).toBe('infra_task');
    expect(mockDb.createChangelogEntry).not.toHaveBeenCalled();
  });

  it('returns duplicate when a changelog entry already exists for the task', async () => {
    mockDb.hasChangelogEntryForTask.mockResolvedValue(true);
    const res = await request('/v1/changelog/from-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: 'task-uuid-1' }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.skipped).toBe(true);
    expect(json.reason).toBe('duplicate');
    expect(mockDb.createChangelogEntry).not.toHaveBeenCalled();
  });

  it('returns 404 when task is not found', async () => {
    mockDb.getTask.mockResolvedValue(null);
    const res = await request('/v1/changelog/from-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: 'nonexistent' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 when task_id is missing', async () => {
    const res = await request('/v1/changelog/from-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('skips when task has no project_slug', async () => {
    mockDb.getTask.mockResolvedValue({ ...baseTask, project_slug: null });
    const res = await request('/v1/changelog/from-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: 'task-uuid-1' }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.skipped).toBe(true);
    expect(json.reason).toBe('no_project');
  });

  it('passes agent and evidence metadata when provided', async () => {
    const res = await request('/v1/changelog/from-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: 'task-uuid-1', agent: 'claude-work', evidence: 'PR #42' }),
    });
    expect(res.status).toBe(201);
    expect(mockDb.createChangelogEntry).toHaveBeenCalledWith(
      expect.objectContaining({ agent: 'claude-work', evidence: 'PR #42' })
    );
  });

  it('can date a task-derived entry by task updated_at for backfills', async () => {
    const res = await request('/v1/changelog/from-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: 'task-uuid-1', source: 'symphony-backfill', use_task_updated_at: true }),
    });
    expect(res.status).toBe(201);
    expect(mockDb.createChangelogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'symphony-backfill',
        created_at: '2026-05-26 00:00:00',
        updated_at: '2026-05-26 00:00:00',
      })
    );
  });
});
