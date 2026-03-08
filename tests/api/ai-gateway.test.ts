import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './helpers';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockDb = {
  getCliTokenUser: vi.fn(),
  getProjectByApiKey: vi.fn(),
  getProjectById: vi.fn(),
  getProjectAIConfig: vi.fn(),
  updateProjectAIConfig: vi.fn(),
  deleteProjectAIConfig: vi.fn(),
  getAIUsageStats: vi.fn(),
  listAIRequests: vi.fn(),
  logAIRequest: vi.fn(),
  searchChunks: vi.fn(),
  upsertUser: vi.fn(),
};

vi.mock('../../workers/api/src/db', () => ({
  getDb: () => mockDb,
}));

const mockChatCompletion = vi.fn();
const mockEmbeddings = vi.fn();
const mockParseUsage = vi.fn();

vi.mock('../../workers/api/src/llm', () => ({
  chatCompletion: (...args: any[]) => mockChatCompletion(...args),
  embeddings: (...args: any[]) => mockEmbeddings(...args),
  parseUsage: (...args: any[]) => mockParseUsage(...args),
}));

const mockGetEmbeddings = vi.fn();

vi.mock('../../workers/api/src/embeddings', () => ({
  getEmbeddings: (...args: any[]) => mockGetEmbeddings(...args),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function sessionHeaders(extra: Record<string, string> = {}) {
  return {
    Authorization: 'Bearer sm_test_token',
    ...extra,
  };
}

function apiKeyHeaders(extra: Record<string, string> = {}) {
  return {
    'X-Project-Key': 'pk_test_key',
    'Content-Type': 'application/json',
    ...extra,
  };
}

const PROJECT_ID = 'proj-1';
const USER_ID = 'user-1';

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();

  // Default: CLI token auth resolves
  mockDb.getCliTokenUser.mockResolvedValue({ user_id: USER_ID });
  // Default: API key auth resolves
  mockDb.getProjectByApiKey.mockResolvedValue({ id: PROJECT_ID });
  // Default: project ownership check passes
  mockDb.getProjectById.mockResolvedValue({ id: PROJECT_ID, owner_id: USER_ID, embedding_model: 'text-embedding-ada-002' });
  // Default: logging never rejects
  mockDb.logAIRequest.mockResolvedValue(undefined);
  // Default: parseUsage
  mockParseUsage.mockReturnValue({ input_tokens: 10, output_tokens: 20 });
});

// ── Auth guard tests ─────────────────────────────────────────────────────────

describe('AI Gateway auth guards', () => {
  it('GET /v1/ai/config/:projectId without Bearer token returns 401', async () => {
    const res = await request(`/v1/ai/config/${PROJECT_ID}`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('PUT /v1/ai/config/:projectId without Bearer token returns 401', async () => {
    const res = await request(`/v1/ai/config/${PROJECT_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai_base_url: 'http://x', ai_api_key: 'k', ai_model: 'm' }),
    });
    expect(res.status).toBe(401);
  });

  it('DELETE /v1/ai/config/:projectId without Bearer token returns 401', async () => {
    const res = await request(`/v1/ai/config/${PROJECT_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('GET /v1/ai/usage/:projectId without Bearer token returns 401', async () => {
    const res = await request(`/v1/ai/usage/${PROJECT_ID}`);
    expect(res.status).toBe(401);
  });

  it('GET /v1/ai/requests/:projectId without Bearer token returns 401', async () => {
    const res = await request(`/v1/ai/requests/${PROJECT_ID}`);
    expect(res.status).toBe(401);
  });

  it('POST /v1/ai/chat/completions without X-Project-Key returns 401', async () => {
    const res = await request('/v1/ai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });

  it('POST /v1/ai/embeddings without X-Project-Key returns 401', async () => {
    const res = await request('/v1/ai/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'hello' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /v1/ai/rag without X-Project-Key returns 401', async () => {
    const res = await request('/v1/ai/rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test', index_id: 'idx-1' }),
    });
    expect(res.status).toBe(401);
  });
});

// ── Config CRUD ──────────────────────────────────────────────────────────────

describe('GET /v1/ai/config/:projectId', () => {
  it('returns 403 when user does not own project', async () => {
    mockDb.getProjectById.mockResolvedValue({ id: PROJECT_ID, owner_id: 'other-user' });

    const res = await request(`/v1/ai/config/${PROJECT_ID}`, {
      headers: sessionHeaders(),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('returns 403 when project does not exist', async () => {
    mockDb.getProjectById.mockResolvedValue(null);

    const res = await request(`/v1/ai/config/${PROJECT_ID}`, {
      headers: sessionHeaders(),
    });
    expect(res.status).toBe(403);
  });

  it('returns config with masked API key', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.openai.com/v1',
      ai_api_key: 'sk-1234567890abcdef',
      ai_model: 'gpt-4o',
    });

    const res = await request(`/v1/ai/config/${PROJECT_ID}`, {
      headers: sessionHeaders(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ai_base_url).toBe('https://api.openai.com/v1');
    expect(body.ai_api_key).toBe('sk-1234...cdef');
    expect(body.ai_model).toBe('gpt-4o');
  });

  it('returns null ai_api_key when not configured', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: null,
      ai_api_key: null,
      ai_model: null,
    });

    const res = await request(`/v1/ai/config/${PROJECT_ID}`, {
      headers: sessionHeaders(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ai_api_key).toBeNull();
  });
});

describe('PUT /v1/ai/config/:projectId', () => {
  it('returns 403 when user does not own project', async () => {
    mockDb.getProjectById.mockResolvedValue({ id: PROJECT_ID, owner_id: 'other-user' });

    const res = await request(`/v1/ai/config/${PROJECT_ID}`, {
      method: 'PUT',
      headers: sessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ai_base_url: 'http://x', ai_api_key: 'k', ai_model: 'm' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 when ai_base_url is missing', async () => {
    const res = await request(`/v1/ai/config/${PROJECT_ID}`, {
      method: 'PUT',
      headers: sessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ai_base_url: '', ai_api_key: 'key', ai_model: 'model' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/ai_base_url/);
  });

  it('returns 400 when ai_api_key is missing', async () => {
    const res = await request(`/v1/ai/config/${PROJECT_ID}`, {
      method: 'PUT',
      headers: sessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ai_base_url: 'http://x', ai_api_key: '  ', ai_model: 'model' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when ai_model is missing', async () => {
    const res = await request(`/v1/ai/config/${PROJECT_ID}`, {
      method: 'PUT',
      headers: sessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ai_base_url: 'http://x', ai_api_key: 'key', ai_model: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('updates config successfully and trims whitespace', async () => {
    mockDb.updateProjectAIConfig.mockResolvedValue(undefined);

    const res = await request(`/v1/ai/config/${PROJECT_ID}`, {
      method: 'PUT',
      headers: sessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        ai_base_url: '  https://api.openai.com/v1  ',
        ai_api_key: '  sk-abc  ',
        ai_model: '  gpt-4o  ',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockDb.updateProjectAIConfig).toHaveBeenCalledWith(PROJECT_ID, {
      ai_base_url: 'https://api.openai.com/v1',
      ai_api_key: 'sk-abc',
      ai_model: 'gpt-4o',
    });
  });
});

describe('DELETE /v1/ai/config/:projectId', () => {
  it('returns 403 when user does not own project', async () => {
    mockDb.getProjectById.mockResolvedValue({ id: PROJECT_ID, owner_id: 'other-user' });

    const res = await request(`/v1/ai/config/${PROJECT_ID}`, {
      method: 'DELETE',
      headers: sessionHeaders(),
    });
    expect(res.status).toBe(403);
  });

  it('deletes config successfully', async () => {
    mockDb.deleteProjectAIConfig.mockResolvedValue(undefined);

    const res = await request(`/v1/ai/config/${PROJECT_ID}`, {
      method: 'DELETE',
      headers: sessionHeaders(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockDb.deleteProjectAIConfig).toHaveBeenCalledWith(PROJECT_ID);
  });
});

// ── Usage ────────────────────────────────────────────────────────────────────

describe('GET /v1/ai/usage/:projectId', () => {
  it('returns 403 when user does not own project', async () => {
    mockDb.getProjectById.mockResolvedValue({ id: PROJECT_ID, owner_id: 'other-user' });

    const res = await request(`/v1/ai/usage/${PROJECT_ID}`, {
      headers: sessionHeaders(),
    });
    expect(res.status).toBe(403);
  });

  it('returns usage stats with default 30 days', async () => {
    const stats = { total_requests: 100, total_input_tokens: 5000, total_output_tokens: 3000 };
    mockDb.getAIUsageStats.mockResolvedValue(stats);

    const res = await request(`/v1/ai/usage/${PROJECT_ID}`, {
      headers: sessionHeaders(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(stats);
    expect(mockDb.getAIUsageStats).toHaveBeenCalledWith(PROJECT_ID, 30);
  });

  it('passes custom days query parameter', async () => {
    mockDb.getAIUsageStats.mockResolvedValue({});

    const res = await request(`/v1/ai/usage/${PROJECT_ID}?days=7`, {
      headers: sessionHeaders(),
    });
    expect(res.status).toBe(200);
    expect(mockDb.getAIUsageStats).toHaveBeenCalledWith(PROJECT_ID, 7);
  });
});

describe('GET /v1/ai/requests/:projectId', () => {
  it('returns 403 when user does not own project', async () => {
    mockDb.getProjectById.mockResolvedValue({ id: PROJECT_ID, owner_id: 'other-user' });

    const res = await request(`/v1/ai/requests/${PROJECT_ID}`, {
      headers: sessionHeaders(),
    });
    expect(res.status).toBe(403);
  });

  it('returns paginated requests with default limit/offset', async () => {
    const result = { rows: [{ id: 'req-1' }], total: 1 };
    mockDb.listAIRequests.mockResolvedValue(result);

    const res = await request(`/v1/ai/requests/${PROJECT_ID}`, {
      headers: sessionHeaders(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(result);
    expect(mockDb.listAIRequests).toHaveBeenCalledWith(PROJECT_ID, 50, 0);
  });

  it('passes custom limit and offset query parameters', async () => {
    mockDb.listAIRequests.mockResolvedValue({ rows: [], total: 0 });

    const res = await request(`/v1/ai/requests/${PROJECT_ID}?limit=10&offset=20`, {
      headers: sessionHeaders(),
    });
    expect(res.status).toBe(200);
    expect(mockDb.listAIRequests).toHaveBeenCalledWith(PROJECT_ID, 10, 20);
  });
});

// ── Proxy: chat/completions ──────────────────────────────────────────────────

describe('POST /v1/ai/chat/completions', () => {
  it('returns 400 when no AI config and no free tier env', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: null,
      ai_api_key: null,
      ai_model: null,
    });

    // Use app.request directly to override env without FREE_AI vars
    const appModule = await import('../../workers/api/src/index');
    const res = await appModule.default.request('/v1/ai/chat/completions', {
      method: 'POST',
      headers: { 'X-Project-Key': 'pk_test_key', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    }, {
      AUTH_SECRET: 'test-auth-secret-at-least-32-chars-long',
      APP_BASE_URL: 'http://localhost:3000',
      CORS_ORIGIN: '*',
      DATABASE_URL: 'postgresql://localhost:26257/test',
      FEEDBACK_IMAGES: {} as any,
      RESEND_API_KEY: 'test',
      NOTIFICATION_FROM_EMAIL: 'test@test.com',
      // Deliberately omit FREE_AI_BASE_URL and FREE_AI_API_KEY
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not configured/i);
  });

  it('uses free tier config when project has no custom config', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: null,
      ai_api_key: null,
      ai_model: null,
    });

    const llmResponse = new Response(JSON.stringify({ choices: [{ message: { content: 'Hello!' } }], usage: { prompt_tokens: 10, completion_tokens: 20 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    mockChatCompletion.mockResolvedValue(llmResponse);

    const res = await request('/v1/ai/chat/completions', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });

    expect(res.status).toBe(200);
    expect(mockChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          baseUrl: 'http://localhost:8787',
          apiKey: 'test-api-key',
          model: 'gpt-4o-mini',
        }),
        messages: [{ role: 'user', content: 'hi' }],
      }),
    );
  });

  it('uses custom project config when available', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://custom.api.com/v1',
      ai_api_key: 'sk-custom',
      ai_model: 'gpt-4o',
    });

    const llmResponse = new Response(JSON.stringify({ choices: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    mockChatCompletion.mockResolvedValue(llmResponse);

    const res = await request('/v1/ai/chat/completions', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });

    expect(res.status).toBe(200);
    expect(mockChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          baseUrl: 'https://custom.api.com/v1',
          apiKey: 'sk-custom',
          model: 'gpt-4o',
        }),
      }),
    );
  });

  it('allows body.model to override config model', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://custom.api.com/v1',
      ai_api_key: 'sk-custom',
      ai_model: 'gpt-4o',
    });

    const llmResponse = new Response(JSON.stringify({ choices: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    mockChatCompletion.mockResolvedValue(llmResponse);

    await request('/v1/ai/chat/completions', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hi' }],
        model: 'claude-3-sonnet',
      }),
    });

    expect(mockChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ model: 'claude-3-sonnet' }),
      }),
    );
  });

  it('passes temperature and max_tokens through', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.com/v1',
      ai_api_key: 'key',
      ai_model: 'gpt-4o',
    });

    const llmResponse = new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    mockChatCompletion.mockResolvedValue(llmResponse);

    await request('/v1/ai/chat/completions', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    expect(mockChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.7,
        max_tokens: 1000,
      }),
    );
  });

  it('passes stream flag through', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.com/v1',
      ai_api_key: 'key',
      ai_model: 'gpt-4o',
    });

    const llmResponse = new Response('data: {"choices":[]}\n\n', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
    mockChatCompletion.mockResolvedValue(llmResponse);

    const res = await request('/v1/ai/chat/completions', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(mockChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ stream: true }),
    );
  });

  it('logs usage for non-streaming responses', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.com/v1',
      ai_api_key: 'key',
      ai_model: 'gpt-4o',
    });

    const responseData = { choices: [], usage: { prompt_tokens: 10, completion_tokens: 20 } };
    const llmResponse = new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    mockChatCompletion.mockResolvedValue(llmResponse);

    await request('/v1/ai/chat/completions', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });

    // Wait for fire-and-forget promise
    await new Promise((r) => setTimeout(r, 50));

    expect(mockDb.logAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT_ID,
        endpoint: '/chat/completions',
        model: 'gpt-4o',
        status: 'success',
        inputTokens: 10,
        outputTokens: 20,
        errorMessage: null,
      }),
    );
  });

  it('logs streaming requests without token counts', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.com/v1',
      ai_api_key: 'key',
      ai_model: 'gpt-4o',
    });

    const llmResponse = new Response('data: {}\n\n', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
    mockChatCompletion.mockResolvedValue(llmResponse);

    await request('/v1/ai/chat/completions', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      }),
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(mockDb.logAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT_ID,
        endpoint: '/chat/completions',
        status: 'success',
        inputTokens: null,
        outputTokens: null,
      }),
    );
  });

  it('preserves upstream status code and Content-Type', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.com/v1',
      ai_api_key: 'key',
      ai_model: 'gpt-4o',
    });

    const llmResponse = new Response(JSON.stringify({ error: 'rate limited' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
    mockChatCompletion.mockResolvedValue(llmResponse);

    const res = await request('/v1/ai/chat/completions', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });

    expect(res.status).toBe(429);
  });
});

// ── Proxy: embeddings ────────────────────────────────────────────────────────

describe('POST /v1/ai/embeddings', () => {
  it('returns 400 when no AI config available', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: null,
      ai_api_key: null,
      ai_model: null,
    });

    const appModule = await import('../../workers/api/src/index');
    const res = await appModule.default.request('/v1/ai/embeddings', {
      method: 'POST',
      headers: { 'X-Project-Key': 'pk_test_key', 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'hello' }),
    }, {
      AUTH_SECRET: 'test-auth-secret-at-least-32-chars-long',
      APP_BASE_URL: 'http://localhost:3000',
      CORS_ORIGIN: '*',
      DATABASE_URL: 'postgresql://localhost:26257/test',
      FEEDBACK_IMAGES: {} as any,
      RESEND_API_KEY: 'test',
      NOTIFICATION_FROM_EMAIL: 'test@test.com',
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not configured/i);
  });

  it('proxies embeddings request successfully', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.com/v1',
      ai_api_key: 'key',
      ai_model: 'text-embedding-3-small',
    });

    const embResponse = new Response(
      JSON.stringify({ data: [{ embedding: [0.1, 0.2] }], usage: { prompt_tokens: 5, completion_tokens: 0 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
    mockEmbeddings.mockResolvedValue(embResponse);

    const res = await request('/v1/ai/embeddings', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ input: 'hello world' }),
    });

    expect(res.status).toBe(200);
    expect(mockEmbeddings).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'https://api.com/v1', apiKey: 'key' }),
      'hello world',
      'text-embedding-3-small',
    );
  });

  it('allows body.model to override embedding model', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.com/v1',
      ai_api_key: 'key',
      ai_model: 'text-embedding-3-small',
    });

    const embResponse = new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    mockEmbeddings.mockResolvedValue(embResponse);

    await request('/v1/ai/embeddings', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ input: 'hello', model: 'text-embedding-ada-002' }),
    });

    expect(mockEmbeddings).toHaveBeenCalledWith(
      expect.anything(),
      'hello',
      'text-embedding-ada-002',
    );
  });

  it('logs usage for embedding requests', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.com/v1',
      ai_api_key: 'key',
      ai_model: 'text-embedding-3-small',
    });

    const embResponse = new Response(
      JSON.stringify({ data: [], usage: { prompt_tokens: 5, completion_tokens: 0 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
    mockEmbeddings.mockResolvedValue(embResponse);

    await request('/v1/ai/embeddings', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ input: 'hello' }),
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(mockDb.logAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT_ID,
        endpoint: '/embeddings',
        status: 'success',
      }),
    );
  });
});

// ── Proxy: RAG ───────────────────────────────────────────────────────────────

describe('POST /v1/ai/rag', () => {
  it('returns 400 when no AI config available', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: null,
      ai_api_key: null,
      ai_model: null,
    });

    const appModule = await import('../../workers/api/src/index');
    const res = await appModule.default.request('/v1/ai/rag', {
      method: 'POST',
      headers: { 'X-Project-Key': 'pk_test_key', 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test', index_id: 'idx-1' }),
    }, {
      AUTH_SECRET: 'test-auth-secret-at-least-32-chars-long',
      APP_BASE_URL: 'http://localhost:3000',
      CORS_ORIGIN: '*',
      DATABASE_URL: 'postgresql://localhost:26257/test',
      FEEDBACK_IMAGES: {} as any,
      RESEND_API_KEY: 'test',
      NOTIFICATION_FROM_EMAIL: 'test@test.com',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when query is missing', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.com/v1',
      ai_api_key: 'key',
      ai_model: 'gpt-4o',
    });

    const res = await request('/v1/ai/rag', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ index_id: 'idx-1' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/query/i);
  });

  it('returns 400 when query is empty string', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.com/v1',
      ai_api_key: 'key',
      ai_model: 'gpt-4o',
    });

    const res = await request('/v1/ai/rag', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ query: '   ', index_id: 'idx-1' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/query/i);
  });

  it('returns 400 when index_id is missing', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.com/v1',
      ai_api_key: 'key',
      ai_model: 'gpt-4o',
    });

    const res = await request('/v1/ai/rag', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ query: 'test' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/index_id/i);
  });

  it('returns 400 when project has no embedding model', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.com/v1',
      ai_api_key: 'key',
      ai_model: 'gpt-4o',
    });
    mockDb.getProjectById.mockResolvedValue({ id: PROJECT_ID, owner_id: USER_ID, embedding_model: null });

    const res = await request('/v1/ai/rag', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ query: 'test', index_id: 'idx-1' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/embedding model/i);
  });

  it('returns 502 when embedding generation fails', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.com/v1',
      ai_api_key: 'key',
      ai_model: 'gpt-4o',
    });
    mockGetEmbeddings.mockRejectedValue(new Error('upstream failure'));

    const res = await request('/v1/ai/rag', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ query: 'test', index_id: 'idx-1' }),
    });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/embedding/i);
  });

  it('performs full RAG pipeline successfully', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.com/v1',
      ai_api_key: 'key',
      ai_model: 'gpt-4o',
    });
    mockGetEmbeddings.mockResolvedValue([[0.1, 0.2, 0.3]]);
    mockDb.searchChunks.mockResolvedValue([
      { content: 'Chunk 1 content' },
      { content: 'Chunk 2 content' },
    ]);

    const chatResponse = new Response(
      JSON.stringify({ choices: [{ message: { content: 'Based on context...' } }], usage: { prompt_tokens: 50, completion_tokens: 30 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
    mockChatCompletion.mockResolvedValue(chatResponse);

    const res = await request('/v1/ai/rag', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ query: 'what is X?', index_id: 'idx-1' }),
    });

    expect(res.status).toBe(200);

    // Verify embedding was generated for the query
    expect(mockGetEmbeddings).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'text-embedding-ada-002',
        projectId: PROJECT_ID,
      }),
      ['what is X?'],
    );

    // Verify vector search was performed
    expect(mockDb.searchChunks).toHaveBeenCalledWith('idx-1', [0.1, 0.2, 0.3], 5);

    // Verify chat completion was called with context
    expect(mockChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ model: 'gpt-4o' }),
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('Chunk 1 content'),
          }),
          expect.objectContaining({ role: 'user', content: 'what is X?' }),
        ]),
      }),
    );
  });

  it('uses custom top_k parameter', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.com/v1',
      ai_api_key: 'key',
      ai_model: 'gpt-4o',
    });
    mockGetEmbeddings.mockResolvedValue([[0.1, 0.2]]);
    mockDb.searchChunks.mockResolvedValue([]);

    const chatResponse = new Response(JSON.stringify({ choices: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    mockChatCompletion.mockResolvedValue(chatResponse);

    await request('/v1/ai/rag', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ query: 'test', index_id: 'idx-1', top_k: 10 }),
    });

    expect(mockDb.searchChunks).toHaveBeenCalledWith('idx-1', [0.1, 0.2], 10);
  });

  it('uses custom system_prompt when provided', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.com/v1',
      ai_api_key: 'key',
      ai_model: 'gpt-4o',
    });
    mockGetEmbeddings.mockResolvedValue([[0.1]]);
    mockDb.searchChunks.mockResolvedValue([{ content: 'data' }]);

    const chatResponse = new Response(JSON.stringify({ choices: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    mockChatCompletion.mockResolvedValue(chatResponse);

    await request('/v1/ai/rag', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({
        query: 'test',
        index_id: 'idx-1',
        system_prompt: 'You are a pirate assistant.',
      }),
    });

    expect(mockChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('You are a pirate assistant.'),
          }),
        ]),
      }),
    );
  });

  it('supports streaming in RAG', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.com/v1',
      ai_api_key: 'key',
      ai_model: 'gpt-4o',
    });
    mockGetEmbeddings.mockResolvedValue([[0.1]]);
    mockDb.searchChunks.mockResolvedValue([{ content: 'data' }]);

    const chatResponse = new Response('data: {}\n\n', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
    mockChatCompletion.mockResolvedValue(chatResponse);

    const res = await request('/v1/ai/rag', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ query: 'test', index_id: 'idx-1', stream: true }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');

    expect(mockChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ stream: true }),
    );
  });

  it('logs usage for non-streaming RAG responses', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.com/v1',
      ai_api_key: 'key',
      ai_model: 'gpt-4o',
    });
    mockGetEmbeddings.mockResolvedValue([[0.1]]);
    mockDb.searchChunks.mockResolvedValue([{ content: 'data' }]);

    const chatResponse = new Response(
      JSON.stringify({ choices: [], usage: { prompt_tokens: 50, completion_tokens: 30 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
    mockChatCompletion.mockResolvedValue(chatResponse);

    await request('/v1/ai/rag', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ query: 'test', index_id: 'idx-1' }),
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(mockDb.logAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT_ID,
        endpoint: '/rag',
        model: 'gpt-4o',
        status: 'success',
      }),
    );
  });
});

// ── Helper functions (maskApiKey, resolveConfig) ─────────────────────────────
// These are not exported, so we test them indirectly through the routes above.
// Additional indirect coverage:

describe('maskApiKey behavior (via GET /v1/ai/config)', () => {
  it('masks long API keys showing first 7 and last 4 chars', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.openai.com/v1',
      ai_api_key: 'sk-abcdefghijklmnop',
      ai_model: 'gpt-4o',
    });

    const res = await request(`/v1/ai/config/${PROJECT_ID}`, {
      headers: sessionHeaders(),
    });
    const body = await res.json();
    // 'sk-abcdefghijklmnop' -> first 7: 'sk-abcd', last 4: 'mnop'
    expect(body.ai_api_key).toBe('sk-abcd...mnop');
  });

  it('masks short API keys as ***', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.openai.com/v1',
      ai_api_key: 'short-key',  // 9 chars, <= 11
      ai_model: 'gpt-4o',
    });

    const res = await request(`/v1/ai/config/${PROJECT_ID}`, {
      headers: sessionHeaders(),
    });
    const body = await res.json();
    expect(body.ai_api_key).toBe('***');
  });

  it('masks 11-char key as ***', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.openai.com/v1',
      ai_api_key: '12345678901',  // exactly 11 chars
      ai_model: 'gpt-4o',
    });

    const res = await request(`/v1/ai/config/${PROJECT_ID}`, {
      headers: sessionHeaders(),
    });
    const body = await res.json();
    expect(body.ai_api_key).toBe('***');
  });

  it('masks 12-char key showing first 7 + last 4', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://api.openai.com/v1',
      ai_api_key: '123456789012',  // 12 chars
      ai_model: 'gpt-4o',
    });

    const res = await request(`/v1/ai/config/${PROJECT_ID}`, {
      headers: sessionHeaders(),
    });
    const body = await res.json();
    expect(body.ai_api_key).toBe('1234567...9012');
  });
});

describe('resolveConfig behavior (via proxy routes)', () => {
  it('falls back to free tier when project has partial config (missing api_key)', async () => {
    mockDb.getProjectAIConfig.mockResolvedValue({
      ai_base_url: 'https://custom.com/v1',
      ai_api_key: null,
      ai_model: 'gpt-4o',
    });

    const llmResponse = new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    mockChatCompletion.mockResolvedValue(llmResponse);

    await request('/v1/ai/chat/completions', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });

    // Should fall back to free tier since config is incomplete
    expect(mockChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          baseUrl: 'http://localhost:8787',
          apiKey: 'test-api-key',
          model: 'gpt-4o-mini',
        }),
      }),
    );
  });
});
