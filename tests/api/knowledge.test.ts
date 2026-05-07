import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  createIndex: vi.fn(),
  listIndexesByProject: vi.fn(),
  getIndexById: vi.fn(),
  deleteIndex: vi.fn(),
  createDocument: vi.fn(),
  getDocumentById: vi.fn(),
  deleteDocument: vi.fn(),
  deleteChunksByDocument: vi.fn(),
  createChunks: vi.fn(),
  listDocumentsByIndex: vi.fn(),
  searchChunks: vi.fn(),
  getProjectById: vi.fn(),
}));

type MockContext = {
  req: { header: (name: string) => string | undefined };
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
  json: (body: unknown, status?: number) => Response;
};

vi.mock('../../workers/api/src/db', () => ({
  getDb: () => mockDb,
}));

vi.mock('../../workers/api/src/middleware/auth', () => ({
  requireSession: async (c: MockContext, next: () => Promise<void>) => {
    if (!c.req.header('Authorization')) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', 'user-1');
    await next();
  },
  requireApiKey: async (c: MockContext, next: () => Promise<void>) => {
    if (!c.req.header('X-Project-Key')) return c.json({ error: 'Unauthorized' }, 401);
    c.set('projectId', 'proj-1');
    c.set('project', { id: 'proj-1', owner_id: 'user-1' });
    await next();
  },
  requireApiKeyOrSession: async (c: MockContext, next: () => Promise<void>) => {
    if (c.req.header('X-Project-Key')) {
      c.set('projectId', 'proj-1');
      c.set('project', { id: 'proj-1', owner_id: 'user-1' });
      await next();
      return;
    }
    if (!c.req.header('Authorization')) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', 'user-1');
    await next();
  },
  resolveBearerUserId: vi.fn().mockResolvedValue('user-1'),
}));

vi.mock('@saas-maker/ops', () => ({
  configurePostHog: vi.fn(),
  capture: vi.fn(),
  flushPostHog: vi.fn(),
  trace: (_name: string, fn: () => Promise<unknown>) => fn(),
}));

import { request } from './helpers';

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.getProjectById.mockResolvedValue({ id: 'proj-1', owner_id: 'user-1' });
  mockDb.createIndex.mockResolvedValue({
    id: 'idx-1',
    project_id: 'proj-1',
    name: 'Docs',
    external_id: null,
    document_count: 0,
    created_at: '2026-01-01T00:00:00Z',
  });
  mockDb.listIndexesByProject.mockResolvedValue([
    {
      id: 'idx-1',
      project_id: 'proj-1',
      name: 'Docs',
      external_id: null,
      document_count: 2,
      created_at: '2026-01-01T00:00:00Z',
    },
  ]);
  mockDb.getIndexById.mockResolvedValue({ id: 'idx-1', project_id: 'proj-1', name: 'Docs' });
  mockDb.createDocument.mockResolvedValue({
    id: 'doc-1',
    index_id: 'idx-1',
    content: 'hello docs',
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  });
  mockDb.createChunks.mockResolvedValue(undefined);
  mockDb.listDocumentsByIndex.mockResolvedValue({ data: [], total: 0 });
  mockDb.searchChunks.mockResolvedValue([
    {
      document_id: 'doc-1',
      content: 'hello docs',
      score: 0.91,
      metadata: { source: 'test' },
    },
  ]);
});

describe('Knowledge Base routes require auth', () => {
  it('POST /v1/knowledge/indexes without session token returns 401', async () => {
    const res = await request('/v1/knowledge/indexes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Index', project_id: '123' }),
    });
    expect(res.status).toBe(401);
  });

  it('GET /v1/knowledge/indexes without session token returns 401', async () => {
    const res = await request('/v1/knowledge/indexes?project_id=123');
    expect(res.status).toBe(401);
  });

  it('POST /v1/knowledge/indexes/:id/documents without auth returns 401', async () => {
    const res = await request('/v1/knowledge/indexes/123/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'test content' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /v1/knowledge/indexes/:id/search without auth returns 401', async () => {
    const res = await request('/v1/knowledge/indexes/123/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('Knowledge Base dashboard routes', () => {
  it('creates an index only for an owned project', async () => {
    const res = await request('/v1/knowledge/indexes', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-session', 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: 'proj-1', name: ' Docs ', external_id: 'external-docs' }),
    });

    expect(res.status).toBe(201);
    expect(mockDb.createIndex).toHaveBeenCalledWith(expect.objectContaining({
      project_id: 'proj-1',
      name: 'Docs',
      external_id: 'external-docs',
    }));
  });

  it('forbids index creation for a project owned by another user', async () => {
    mockDb.getProjectById.mockResolvedValueOnce({ id: 'proj-2', owner_id: 'user-2' });

    const res = await request('/v1/knowledge/indexes', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-session', 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: 'proj-2', name: 'Docs' }),
    });

    expect(res.status).toBe(403);
    expect(mockDb.createIndex).not.toHaveBeenCalled();
  });

  it('lists indexes for an owned project', async () => {
    const res = await request('/v1/knowledge/indexes?project_id=proj-1', {
      headers: { Authorization: 'Bearer test-session' },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ data: [{ id: 'idx-1', document_count: 2 }] });
    expect(mockDb.listIndexesByProject).toHaveBeenCalledWith('proj-1');
  });
});

describe('Knowledge Base document routes', () => {
  it('ingests content, creates embeddings, and writes chunks', async () => {
    const ai = { run: vi.fn().mockResolvedValue({ data: [[0.1, 0.2, 0.3]] }) };

    const res = await request(
      '/v1/knowledge/indexes/idx-1/documents',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer test-session', 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'hello docs', metadata: { source: 'test' } }),
      },
      { AI: ai },
    );

    expect(res.status).toBe(201);
    expect(ai.run).toHaveBeenCalledWith('@cf/baai/bge-base-en-v1.5', { text: ['hello docs'] });
    expect(mockDb.createChunks).toHaveBeenCalledWith([
      expect.objectContaining({
        document_id: 'doc-1',
        index_id: 'idx-1',
        content: 'hello docs',
        embedding: [0.1, 0.2, 0.3],
        chunk_index: 0,
      }),
    ]);
  });

  it('clamps semantic search top_k before querying chunks', async () => {
    const ai = { run: vi.fn().mockResolvedValue({ data: [[0.2, 0.3, 0.4]] }) };

    const res = await request(
      '/v1/knowledge/indexes/idx-1/search',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer test-session', 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'docs', top_k: 500 }),
      },
      { AI: ai },
    );

    expect(res.status).toBe(200);
    expect(mockDb.searchChunks).toHaveBeenCalledWith('idx-1', [0.2, 0.3, 0.4], 20);
    expect(await res.json()).toMatchObject({ data: [{ document_id: 'doc-1', score: 0.91 }] });
  });
});
