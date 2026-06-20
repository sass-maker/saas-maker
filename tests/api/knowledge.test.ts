import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  exportKnowledgeIndex: vi.fn(),
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

afterEach(() => {
  vi.unstubAllGlobals();
});

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
  mockDb.getIndexById.mockResolvedValue({
    id: 'idx-1',
    project_id: 'proj-1',
    name: 'Docs',
    external_id: 'external-docs',
  });
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
  mockDb.exportKnowledgeIndex.mockResolvedValue({
    index: { id: 'idx-1', project_id: 'proj-1', name: 'Docs', external_id: 'external-docs' },
    chunks: [
      {
        id: 'chunk-1',
        document_id: 'doc-1',
        document_content: 'hello docs',
        content: 'hello docs',
        embedding: '[0.1,0.2,0.3]',
        chunk_index: 0,
        metadata: '{"source":"test"}',
      },
    ],
  });
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

  it('exports pre-embedded chunks for RAG service backfill', async () => {
    const res = await request('/v1/knowledge/indexes/idx-1/export', {
      headers: { Authorization: 'Bearer test-session' },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      index: {
        name: 'Docs',
        external_id: 'idx-1',
        source_external_id: 'external-docs',
      },
      chunks: [
        {
          id: 'chunk-1',
          document_id: 'doc-1',
          document_content: 'hello docs',
          content: 'hello docs',
          embedding: [0.1, 0.2, 0.3],
          chunk_index: 0,
          metadata: { source: 'test' },
        },
      ],
    });
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

  it('mirrors dual-mode ingests to the standalone RAG service while keeping local chunks', async () => {
    const ai = { run: vi.fn().mockResolvedValue({ data: [[0.1, 0.2, 0.3]] }) };
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith('/v1/indexes')) {
        return Response.json({ data: [{ id: 'rag-idx-1', external_id: 'idx-1', name: 'Docs' }] });
      }
      if (url.endsWith('/v1/indexes/rag-idx-1/ingest-vectors')) {
        return Response.json({ upserted: 1 }, { status: 201 });
      }
      return Response.json({ error: 'unexpected' }, { status: 500 });
    }));

    const res = await request(
      '/v1/knowledge/indexes/idx-1/documents',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer test-session', 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'hello docs', metadata: { source: 'test' } }),
      },
      {
        AI: ai,
        RAG_BACKEND: 'dual',
        RAG_SERVICE_URL: 'https://rag.example',
        RAG_SERVICE_KEY: 'test-rag-key',
      },
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ rag_service_synced: true });
    expect(mockDb.createChunks).toHaveBeenCalled();
    expect(calls.map((call) => call.url)).toEqual([
      'https://rag.example/v1/indexes',
      'https://rag.example/v1/indexes/rag-idx-1/ingest-vectors',
    ]);
    expect(JSON.parse(String(calls[1]?.init?.body))).toMatchObject({
      chunks: [
        {
          document_id: 'doc-1',
          document_content: 'hello docs',
          content: 'hello docs',
          embedding: [0.1, 0.2, 0.3],
          chunk_index: 0,
          metadata: { source: 'test' },
        },
      ],
    });
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

  it('uses the standalone RAG service for service-mode search', async () => {
    const ai = { run: vi.fn().mockResolvedValue({ data: [[0.2, 0.3, 0.4]] }) };
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/v1/indexes') && init?.method !== 'POST') {
        return Response.json({ data: [{ id: 'rag-idx-1', external_id: 'idx-1', name: 'Docs' }] });
      }
      if (url.endsWith('/v1/indexes/rag-idx-1/query')) {
        return Response.json({
          data: [
            {
              document_id: 'doc-1',
              chunk_id: 'chunk-1',
              chunk_content: 'remote docs',
              score: 0.99,
              metadata: { source: 'rag' },
            },
          ],
        });
      }
      return Response.json({ error: 'unexpected' }, { status: 500 });
    }));

    const res = await request(
      '/v1/knowledge/indexes/idx-1/search',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer test-session', 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'docs', top_k: 500 }),
      },
      {
        AI: ai,
        RAG_BACKEND: 'service',
        RAG_SERVICE_URL: 'https://rag.example',
        RAG_SERVICE_KEY: 'test-rag-key',
      },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RAG-Backend')).toBe('service');
    expect(ai.run).not.toHaveBeenCalled();
    expect(mockDb.searchChunks).not.toHaveBeenCalled();
    expect(await res.json()).toMatchObject({
      data: [{ document_id: 'doc-1', chunk_content: 'remote docs', score: 0.99 }],
    });
  });

  it('uses the RAG service binding before public HTTP when configured', async () => {
    const serviceFetch = vi.fn(async (request: Request) => {
      if (request.url.endsWith('/v1/indexes') && request.method !== 'POST') {
        return Response.json({ data: [{ id: 'rag-idx-1', external_id: 'idx-1', name: 'Docs' }] });
      }
      if (request.url.endsWith('/v1/indexes/rag-idx-1/query')) {
        return Response.json({
          data: [
            {
              document_id: 'doc-1',
              chunk_id: 'chunk-1',
              chunk_content: 'bound service docs',
              score: 0.99,
              metadata: { source: 'rag' },
            },
          ],
        });
      }
      return Response.json({ error: 'unexpected' }, { status: 500 });
    });
    const publicFetch = vi.fn(async () => Response.json({ error: 'public fetch should not run' }, { status: 500 }));
    vi.stubGlobal('fetch', publicFetch);

    const res = await request(
      '/v1/knowledge/indexes/idx-1/search',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer test-session', 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'docs', top_k: 5 }),
      },
      {
        RAG_BACKEND: 'service',
        RAG_SERVICE: { fetch: serviceFetch },
        RAG_SERVICE_KEY: 'test-rag-key',
      },
    );
    const second = await request(
      '/v1/knowledge/indexes/idx-1/search',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer test-session', 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'docs', top_k: 5 }),
      },
      {
        RAG_BACKEND: 'service',
        RAG_SERVICE: { fetch: serviceFetch },
        RAG_SERVICE_KEY: 'test-rag-key',
      },
    );

    expect(res.status).toBe(200);
    expect(second.status).toBe(200);
    expect(publicFetch).not.toHaveBeenCalled();
    expect(serviceFetch).toHaveBeenCalledTimes(3);
    expect(serviceFetch.mock.calls[0]?.[0].headers.get('Authorization')).toBe('Bearer test-rag-key');
    expect(serviceFetch.mock.calls.map(([request]) => request.url)).toEqual([
      'https://rag-service.internal/v1/indexes',
      'https://rag-service.internal/v1/indexes/rag-idx-1/query',
      'https://rag-service.internal/v1/indexes/rag-idx-1/query',
    ]);
    expect(await res.json()).toMatchObject({
      data: [{ document_id: 'doc-1', chunk_content: 'bound service docs', score: 0.99 }],
    });
  });
});
