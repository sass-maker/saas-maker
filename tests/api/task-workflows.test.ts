import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  listTaskWorkflows: vi.fn(),
  createTaskWorkflow: vi.fn(),
  getTaskWorkflow: vi.fn(),
  updateTaskWorkflow: vi.fn(),
  createTaskWorkflowArtifact: vi.fn(),
  listTaskWorkflowArtifacts: vi.fn(),
  getTaskWorkflowArtifactByShareToken: vi.fn(),
  getTask: vi.fn(),
  createSymphonyAuditEvent: vi.fn(),
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

const workflow = {
  id: 'workflow-1',
  owner_id: 'user-1',
  task_id: 'task-1',
  project_slug: 'saas-maker',
  name: 'Task workflow',
  description: null,
  context_markdown: '## Context',
  prompt_template: 'Do the task',
  status: 'active',
  last_run_id: null,
  created_at: '2026-06-08 00:00:00',
  updated_at: '2026-06-08 00:00:00',
};

beforeEach(() => {
  mockDb.listTaskWorkflows.mockReset();
  mockDb.listTaskWorkflows.mockResolvedValue([workflow]);
  mockDb.createTaskWorkflow.mockReset();
  mockDb.createTaskWorkflow.mockResolvedValue(workflow);
  mockDb.getTaskWorkflow.mockReset();
  mockDb.getTaskWorkflow.mockResolvedValue(workflow);
  mockDb.updateTaskWorkflow.mockReset();
  mockDb.updateTaskWorkflow.mockImplementation(async (_id: string, _ownerId: string, input: any) => ({ ...workflow, ...input }));
  mockDb.createTaskWorkflowArtifact.mockReset();
  mockDb.createTaskWorkflowArtifact.mockResolvedValue({
    id: 'artifact-1',
    owner_id: 'user-1',
    workflow_id: 'workflow-1',
    task_id: 'task-1',
    project_slug: 'saas-maker',
    run_id: 'run-1',
    type: 'markdown',
    name: 'Result',
    content_markdown: '# Result',
    share_token: 'share-1',
    created_at: '2026-06-08 00:00:00',
  });
  mockDb.listTaskWorkflowArtifacts.mockReset();
  mockDb.listTaskWorkflowArtifacts.mockResolvedValue([]);
  mockDb.getTaskWorkflowArtifactByShareToken.mockReset();
  mockDb.getTaskWorkflowArtifactByShareToken.mockResolvedValue({
    id: 'artifact-1',
    workflow_id: 'workflow-1',
    content_markdown: '# Result',
    share_token: 'share-1',
  });
  mockDb.getTask.mockReset();
  mockDb.getTask.mockResolvedValue({
    id: 'task-1',
    owner_id: 'user-1',
    project_slug: 'saas-maker',
    title: 'Build workflow',
    description: 'Task description',
    status: 'todo',
    priority: 'high',
  });
  mockDb.createSymphonyAuditEvent.mockReset();
  mockDb.createSymphonyAuditEvent.mockResolvedValue({ id: 'audit-1' });
});

describe('Task workflows API', () => {
  it('lists workflows with task and project filters', async () => {
    const res = await request('/v1/task-workflows?task_id=task-1&project_slug=saas-maker&limit=10');

    expect(res.status).toBe(200);
    expect(mockDb.listTaskWorkflows).toHaveBeenCalledWith('user-1', {
      task_id: 'task-1',
      project_slug: 'saas-maker',
      status: undefined,
      limit: 10,
    });
    await expect(res.json()).resolves.toMatchObject({ data: [{ id: 'workflow-1' }] });
  });

  it('creates a task-linked workflow', async () => {
    const res = await request('/v1/task-workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: 'task-1',
        project_slug: 'saas-maker',
        name: 'Task workflow',
        prompt_template: 'Do the task',
        status: 'active',
      }),
    });

    expect(res.status).toBe(201);
    expect(mockDb.createTaskWorkflow).toHaveBeenCalledWith('user-1', expect.objectContaining({
      task_id: 'task-1',
      name: 'Task workflow',
      prompt_template: 'Do the task',
      status: 'active',
    }));
    expect(mockDb.createSymphonyAuditEvent).toHaveBeenCalledWith('user-1', expect.objectContaining({
      action: 'task_workflow_created',
      task_id: 'task-1',
    }));
  });

  it('prepares a Droid-native run prompt and records returned run ids', async () => {
    const res = await request('/v1/task-workflows/workflow-1/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run_id: 'run-1' }),
    });

    expect(res.status).toBe(200);
    expect(mockDb.updateTaskWorkflow).toHaveBeenCalledWith('workflow-1', 'user-1', { last_run_id: 'run-1' });
    const json = await res.json() as { prompt: string; droid_run_payload: { mode: string; prompt: string } };
    expect(json.prompt).toContain('Build workflow');
    expect(json.droid_run_payload.mode).toBe('native');
  });

  it('creates shareable markdown artifacts', async () => {
    const res = await request('/v1/task-workflows/workflow-1/artifacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Result', content_markdown: '# Result', run_id: 'run-1' }),
    });

    expect(res.status).toBe(201);
    expect(mockDb.createTaskWorkflowArtifact).toHaveBeenCalledWith('user-1', 'workflow-1', {
      name: 'Result',
      content_markdown: '# Result',
      run_id: 'run-1',
    });
  });

  it('serves shared artifacts without session auth', async () => {
    const res = await request('/v1/task-workflows/artifacts/share-1');

    expect(res.status).toBe(200);
    expect(mockDb.getTaskWorkflowArtifactByShareToken).toHaveBeenCalledWith('share-1');
  });
});
