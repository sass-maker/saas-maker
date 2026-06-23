import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  getProjectById: vi.fn(),
  getProjectBySlug: vi.fn(),
  listProjectsByOwner: vi.fn(),
  getProjectAIConfig: vi.fn(),
  updateProjectAIConfig: vi.fn(),
  deleteProjectAIConfig: vi.fn(),
  logAIRequest: vi.fn(),
  getAIUsageStats: vi.fn(),
  listAIRequests: vi.fn(),
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
    c.set('projectId', 'proj-1');
    c.set('project', { id: 'proj-1', owner_id: 'user-1' });
    await next();
  },
  requireApiKeyOrSession: async (c: MockContext, next: () => Promise<void>) => {
    c.set('userId', 'user-1');
    await next();
  },
  resolveBearerUserId: vi.fn().mockResolvedValue('user-1'),
}));

vi.mock('../../workers/api/src/lib/telemetry.js', () => ({
  configurePostHog: vi.fn(),
  capture: vi.fn(),
  flushPostHog: vi.fn(),
  trace: (_name: string, fn: () => Promise<unknown>) => fn(),
}));

import { request } from './helpers';

const PROJECT = {
  id: 'proj-1',
  name: 'Test Project',
  slug: 'test-project',
  api_key: 'pk_test',
  owner_id: 'user-1',
  ai_base_url: 'https://api.openai.com/v1',
  ai_api_key: 'sk-secret-provider-key',
  ai_model: 'gpt-4o-mini',
  readme: null,
  source: 'dashboard',
  created_at: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  mockDb.getProjectById.mockResolvedValue(PROJECT);
  mockDb.getProjectAIConfig.mockResolvedValue({
    ai_base_url: 'https://api.openai.com/v1',
    ai_api_key: 'sk-secret-provider-key',
    ai_model: 'gpt-4o-mini',
  });
  mockDb.updateProjectAIConfig.mockResolvedValue(undefined);
  mockDb.deleteProjectAIConfig.mockResolvedValue(undefined);
  mockDb.logAIRequest.mockResolvedValue(undefined);
  mockDb.getAIUsageStats.mockResolvedValue({
    total_requests: 0,
    success_count: 0,
    error_count: 0,
    avg_latency_ms: null,
    total_input_tokens: 0,
    total_output_tokens: 0,
  });
  mockDb.listAIRequests.mockResolvedValue({ data: [], total: 0 });
});

describe('AI Gateway config API', () => {
  it('returns masked provider config without exposing the stored key', async () => {
    const res = await request('/v1/ai/config?project_id=proj-1', {
      headers: { Authorization: 'Bearer test-session' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ai_base_url: 'https://api.openai.com/v1',
      ai_model: 'gpt-4o-mini',
      ai_api_key_configured: true,
      ai_api_key_preview: 'sk-s...-key',
    });
    expect(body).not.toHaveProperty('ai_api_key');
  });

  it('updates provider URL/model while preserving an existing key when no key is provided', async () => {
    mockDb.getProjectAIConfig
      .mockResolvedValueOnce({
        ai_base_url: 'https://api.openai.com/v1',
        ai_api_key: 'sk-secret-provider-key',
        ai_model: 'gpt-4o-mini',
      })
      .mockResolvedValueOnce({
        ai_base_url: 'https://openrouter.ai/api/v1',
        ai_api_key: 'sk-secret-provider-key',
        ai_model: 'openai/gpt-4o-mini',
      });

    const res = await request('/v1/ai/config?project_id=proj-1', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer test-session',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ai_base_url: 'https://openrouter.ai/api/v1/',
        ai_model: 'openai/gpt-4o-mini',
      }),
    });

    expect(res.status).toBe(200);
    expect(mockDb.updateProjectAIConfig).toHaveBeenCalledWith('proj-1', {
      ai_base_url: 'https://openrouter.ai/api/v1',
      ai_model: 'openai/gpt-4o-mini',
    });
    const body = await res.json();
    expect(body).not.toHaveProperty('ai_api_key');
  });

  it('encrypts newly stored provider keys when an encryption secret is configured', async () => {
    mockDb.getProjectAIConfig
      .mockResolvedValueOnce({
        ai_base_url: 'https://api.openai.com/v1',
        ai_api_key: 'sk-existing-key',
        ai_model: 'gpt-4o-mini',
      })
      .mockImplementationOnce(async () => {
        const stored = mockDb.updateProjectAIConfig.mock.calls.at(-1)?.[1].ai_api_key;
        return {
          ai_base_url: 'https://api.openai.com/v1',
          ai_api_key: stored,
          ai_model: 'gpt-4o-mini',
        };
      });

    const res = await request(
      '/v1/ai/config?project_id=proj-1',
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer test-session',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ai_base_url: 'https://api.openai.com/v1',
          ai_model: 'gpt-4o-mini',
          ai_api_key: 'sk-new-provider-key',
        }),
      },
      { AI_GATEWAY_KEY_SECRET: 'test-encryption-secret' }
    );

    expect(res.status).toBe(200);
    const storedKey = mockDb.updateProjectAIConfig.mock.calls.at(-1)?.[1].ai_api_key;
    expect(storedKey).toMatch(/^enc:v1:/);
    expect(storedKey).not.toContain('sk-new-provider-key');
    expect(await res.json()).toMatchObject({
      ai_api_key_configured: true,
      ai_api_key_preview: 'sk-n...-key',
    });
  });
});

describe('AI Gateway proxy API', () => {
  it('proxies chat completions with the stored provider key and logs usage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { role: 'assistant', content: 'Done' } }],
          usage: { prompt_tokens: 4, completion_tokens: 7 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await request('/v1/ai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Project-Key': 'pk_test' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }] }),
    });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-secret-provider-key',
        }),
      })
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    expect(mockDb.logAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj-1',
        endpoint: 'chat/completions',
        model: 'gpt-4o-mini',
        status: 'success',
        inputTokens: 4,
        outputTokens: 7,
        errorMessage: null,
      })
    );

    vi.unstubAllGlobals();
  });

  it('logs provider errors without exposing the provider key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'bad upstream key' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    const res = await request('/v1/ai/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Project-Key': 'pk_test' },
      body: JSON.stringify({ input: 'docs' }),
    });

    expect(res.status).toBe(401);
    expect(mockDb.logAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'embeddings',
        status: 'error',
        errorMessage: '{"error":"bad upstream key"}',
      })
    );

    vi.unstubAllGlobals();
  });

  it('decrypts encrypted provider keys before proxying upstream requests', async () => {
    const updateRes = await request(
      '/v1/ai/config?project_id=proj-1',
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer test-session',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ai_base_url: 'https://api.openai.com/v1',
          ai_model: 'gpt-4o-mini',
          ai_api_key: 'sk-encrypted-provider-key',
        }),
      },
      { AI_GATEWAY_KEY_SECRET: 'proxy-secret' }
    );
    expect(updateRes.status).toBe(200);
    const storedKey = mockDb.updateProjectAIConfig.mock.calls.at(-1)?.[1].ai_api_key;
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.openai.com/v1',
      ai_api_key: storedKey,
      ai_model: 'gpt-4o-mini',
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [], usage: { prompt_tokens: 1 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(
      '/v1/ai/embeddings',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Project-Key': 'pk_test' },
        body: JSON.stringify({ input: 'docs' }),
      },
      { AI_GATEWAY_KEY_SECRET: 'proxy-secret' }
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/embeddings',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-encrypted-provider-key',
        }),
      })
    );

    vi.unstubAllGlobals();
  });

  it('returns 429 before contacting the provider when the AI proxy quota is exhausted', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(
      '/v1/ai/chat/completions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Project-Key': 'pk_test' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }] }),
      },
      { RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: false }) } }
    );

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'AI Gateway rate limit exceeded' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockDb.logAIRequest).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});

describe('Project responses', () => {
  it('sanitizes provider keys from project read responses', async () => {
    mockDb.getProjectBySlug.mockResolvedValue(PROJECT);

    const res = await request('/v1/projects/by-slug/test-project', {
      headers: { Authorization: 'Bearer test-session' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ai_api_key_configured).toBe(true);
    expect(body.ai_api_key_preview).toBe('sk-s...-key');
    expect(body).not.toHaveProperty('ai_api_key');
  });
});
