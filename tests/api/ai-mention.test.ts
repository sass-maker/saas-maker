import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDb, runMentionCheck } = vi.hoisted(() => ({
  mockDb: {
    getCliTokenUser: vi.fn(),
    getProjectById: vi.fn(),
    getAIMentionConfig: vi.fn(),
    upsertAIMentionConfig: vi.fn(),
    deleteAIMentionConfig: vi.fn(),
    listAIMentionPrompts: vi.fn(),
    countAIMentionPrompts: vi.fn(),
    createAIMentionPrompt: vi.fn(),
    deleteAIMentionPrompt: vi.fn(),
    createAIMentionCheck: vi.fn(),
    listAIMentionChecks: vi.fn(),
    getAIMentionCheckById: vi.fn(),
    listAIMentionResults: vi.fn(),
  },
  runMentionCheck: vi.fn(),
}));

vi.mock('../../workers/api/src/db', () => ({
  getDb: () => mockDb,
  createDatabase: () => mockDb,
}));

vi.mock('../../workers/api/src/lib/ai-mention-engine', () => ({
  runMentionCheck,
}));

import { request } from './helpers';

const USER_ID = 'user-1';
const PROJECT_ID = 'proj-1';

const PROJECT = {
  id: PROJECT_ID,
  owner_id: USER_ID,
  name: 'Acme',
  slug: 'acme',
};

const RAW_CONFIG = {
  id: 'cfg-1',
  project_id: PROJECT_ID,
  brand_name: 'Acme',
  brand_aliases: JSON.stringify(['Acme AI', 'Acme SaaS']),
  brand_url: 'https://acme.com',
  competitors: JSON.stringify([{ name: 'Notion' }]),
  platforms: JSON.stringify(['openai', 'google']),
  openai_api_key: 'sk-openai',
  anthropic_api_key: null,
  google_api_key: 'google-key',
  perplexity_api_key: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function sessionHeaders(extra: Record<string, string> = {}) {
  return {
    Authorization: 'Bearer sm_test_token',
    'Content-Type': 'application/json',
    ...extra,
  };
}

beforeEach(() => {
  Object.values(mockDb).forEach((fn) => fn.mockReset());
  runMentionCheck.mockReset();
  runMentionCheck.mockResolvedValue(undefined);

  mockDb.getCliTokenUser.mockResolvedValue({ user_id: USER_ID });
  mockDb.getProjectById.mockResolvedValue(PROJECT);
});

describe('AI Mention routes', () => {
  it('returns 401 without session auth', async () => {
    const res = await request(`/v1/ai-mention/config/${PROJECT_ID}`);
    expect(res.status).toBe(401);
  });

  it('returns 403 when project ownership check fails', async () => {
    mockDb.getProjectById.mockResolvedValue({ ...PROJECT, owner_id: 'other-user' });

    const res = await request(`/v1/ai-mention/config/${PROJECT_ID}`, {
      headers: sessionHeaders(),
    });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden' });
  });

  it('returns parsed config data', async () => {
    mockDb.getAIMentionConfig.mockResolvedValue(RAW_CONFIG);

    const res = await request(`/v1/ai-mention/config/${PROJECT_ID}`, {
      headers: sessionHeaders(),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: 'cfg-1',
      project_id: PROJECT_ID,
      brand_name: 'Acme',
      brand_aliases: ['Acme AI', 'Acme SaaS'],
      brand_url: 'https://acme.com',
      competitors: [{ name: 'Notion' }],
      platforms: ['openai', 'google'],
      has_openai_key: true,
      has_anthropic_key: false,
      has_google_key: true,
      has_perplexity_key: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
  });

  it('validates config payloads', async () => {
    let res = await request(`/v1/ai-mention/config/${PROJECT_ID}`, {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/brand_name/i);

    res = await request(`/v1/ai-mention/config/${PROJECT_ID}`, {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({
        brand_name: 'Acme',
        competitors: new Array(6).fill({ name: 'Competitor' }),
      }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Max 5 competitors/i);

    res = await request(`/v1/ai-mention/config/${PROJECT_ID}`, {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({
        brand_name: 'Acme',
        platforms: ['openai', 'unknown-platform'],
      }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid platform/i);
  });

  it('saves config with serialized arrays', async () => {
    mockDb.upsertAIMentionConfig.mockResolvedValue({
      ...RAW_CONFIG,
      brand_name: 'New Acme',
      brand_aliases: JSON.stringify(['Acme One']),
      competitors: JSON.stringify([{ name: 'Linear', url: 'https://linear.app' }]),
      platforms: JSON.stringify(['openai']),
      google_api_key: null,
    });

    const res = await request(`/v1/ai-mention/config/${PROJECT_ID}`, {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({
        brand_name: 'New Acme',
        brand_aliases: ['Acme One'],
        brand_url: 'https://acme.com',
        competitors: [{ name: 'Linear', url: 'https://linear.app' }],
        platforms: ['openai'],
        openai_api_key: 'sk-openai',
      }),
    });

    expect(res.status).toBe(200);
    expect(mockDb.upsertAIMentionConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: PROJECT_ID,
        brand_name: 'New Acme',
        brand_aliases: JSON.stringify(['Acme One']),
        competitors: JSON.stringify([{ name: 'Linear', url: 'https://linear.app' }]),
        platforms: JSON.stringify(['openai']),
        openai_api_key: 'sk-openai',
      })
    );
  });

  it('validates prompt creation', async () => {
    let res = await request(`/v1/ai-mention/prompts/${PROJECT_ID}`, {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/prompt_text/i);

    mockDb.countAIMentionPrompts.mockResolvedValue(20);
    res = await request(`/v1/ai-mention/prompts/${PROJECT_ID}`, {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({ prompt_text: 'Best project management tool?' }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Max 20 prompts/i);
  });

  it('creates a prompt when under the project limit', async () => {
    mockDb.countAIMentionPrompts.mockResolvedValue(2);
    mockDb.createAIMentionPrompt.mockResolvedValue({
      id: 'prompt-1',
      project_id: PROJECT_ID,
      prompt_text: 'Best project management tool?',
      category: 'pm',
      created_at: '2026-01-01T00:00:00Z',
    });

    const res = await request(`/v1/ai-mention/prompts/${PROJECT_ID}`, {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({
        prompt_text: 'Best project management tool?',
        category: 'pm',
      }),
    });

    expect(res.status).toBe(201);
    expect(mockDb.createAIMentionPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: PROJECT_ID,
        prompt_text: 'Best project management tool?',
        category: 'pm',
      })
    );
  });

  it('validates checks before execution', async () => {
    let res = await request(`/v1/ai-mention/check/${PROJECT_ID}`, {
      method: 'POST',
      headers: sessionHeaders(),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Configure AI Mention Check first/i);

    mockDb.getAIMentionConfig.mockResolvedValue(RAW_CONFIG);
    mockDb.listAIMentionPrompts.mockResolvedValue([]);
    res = await request(`/v1/ai-mention/check/${PROJECT_ID}`, {
      method: 'POST',
      headers: sessionHeaders(),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Add at least one prompt/i);

    mockDb.getAIMentionConfig.mockResolvedValue({
      ...RAW_CONFIG,
      openai_api_key: null,
      google_api_key: null,
      platforms: JSON.stringify(['openai', 'google']),
    });
    mockDb.listAIMentionPrompts.mockResolvedValue([{ id: 'prompt-1', prompt_text: 'Best CRM?' }]);
    res = await request(`/v1/ai-mention/check/${PROJECT_ID}`, {
      method: 'POST',
      headers: sessionHeaders(),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Add at least one API key/i);
  });

  it('starts a check and queues the background runner', async () => {
    mockDb.getAIMentionConfig.mockResolvedValue(RAW_CONFIG);
    mockDb.listAIMentionPrompts.mockResolvedValue([
      { id: 'prompt-1', prompt_text: 'Best CRM?' },
      { id: 'prompt-2', prompt_text: 'Best support tool?' },
    ]);
    mockDb.createAIMentionCheck.mockResolvedValue({
      id: 'check-1',
      project_id: PROJECT_ID,
      status: 'running',
      total_queries: 4,
      completed_queries: 0,
      brand_mention_rate: null,
      summary: null,
      created_at: '2026-01-01T00:00:00Z',
      completed_at: null,
    });

    const res = await request(`/v1/ai-mention/check/${PROJECT_ID}`, {
      method: 'POST',
      headers: sessionHeaders(),
    });

    expect(res.status).toBe(201);
    expect(mockDb.createAIMentionCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        project_id: PROJECT_ID,
        total_queries: 4,
      })
    );
    const generatedCheckId = mockDb.createAIMentionCheck.mock.calls[0][0].id;
    expect(runMentionCheck).toHaveBeenCalledWith(
      mockDb,
      RAW_CONFIG,
      [
        { id: 'prompt-1', prompt_text: 'Best CRM?' },
        { id: 'prompt-2', prompt_text: 'Best support tool?' },
      ],
      generatedCheckId,
      PROJECT_ID
    );
  });

  it('returns check details with parsed result payloads', async () => {
    mockDb.getAIMentionCheckById.mockResolvedValue({
      id: 'check-1',
      project_id: PROJECT_ID,
      status: 'completed',
      total_queries: 2,
      completed_queries: 2,
      brand_mention_rate: 0.5,
      summary: 'Acme was mentioned in 1 of 2 queries',
      created_at: '2026-01-01T00:00:00Z',
      completed_at: '2026-01-01T00:05:00Z',
    });
    mockDb.listAIMentionResults.mockResolvedValue([
      {
        id: 'result-1',
        check_id: 'check-1',
        project_id: PROJECT_ID,
        prompt_id: 'prompt-1',
        platform: 'openai',
        model: 'gpt-4o-mini',
        response_text: '1. Acme https://acme.com',
        brand_mentioned: 1,
        brand_sentiment: 'positive',
        brand_position: 1,
        competitors_mentioned: JSON.stringify([{ name: 'Notion', mentioned: false, position: null }]),
        citations: JSON.stringify(['https://acme.com']),
        brand_cited: 1,
        latency_ms: 321,
        created_at: '2026-01-01T00:01:00Z',
      },
    ]);

    const res = await request(`/v1/ai-mention/checks/${PROJECT_ID}/check-1`, {
      headers: sessionHeaders(),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: 'check-1',
      project_id: PROJECT_ID,
      status: 'completed',
      total_queries: 2,
      completed_queries: 2,
      brand_mention_rate: 0.5,
      summary: 'Acme was mentioned in 1 of 2 queries',
      created_at: '2026-01-01T00:00:00Z',
      completed_at: '2026-01-01T00:05:00Z',
      results: [
        {
          id: 'result-1',
          check_id: 'check-1',
          project_id: PROJECT_ID,
          prompt_id: 'prompt-1',
          platform: 'openai',
          model: 'gpt-4o-mini',
          response_text: '1. Acme https://acme.com',
          brand_mentioned: true,
          brand_sentiment: 'positive',
          brand_position: 1,
          competitors_mentioned: [{ name: 'Notion', mentioned: false, position: null }],
          citations: ['https://acme.com'],
          brand_cited: true,
          latency_ms: 321,
          created_at: '2026-01-01T00:01:00Z',
        },
      ],
    });
  });

  it('returns dashboard summary data', async () => {
    mockDb.getAIMentionConfig.mockResolvedValue(RAW_CONFIG);
    mockDb.listAIMentionPrompts.mockResolvedValue([
      { id: 'prompt-1', prompt_text: 'Best CRM?', category: null, created_at: '2026-01-01T00:00:00Z' },
    ]);
    mockDb.listAIMentionChecks.mockResolvedValue([
      {
        id: 'check-1',
        project_id: PROJECT_ID,
        status: 'completed',
        total_queries: 2,
        completed_queries: 2,
        brand_mention_rate: 1,
        summary: 'Mentioned everywhere',
        created_at: '2026-01-01T00:00:00Z',
        completed_at: '2026-01-01T00:05:00Z',
      },
    ]);
    mockDb.listAIMentionResults.mockResolvedValue([
      {
        id: 'result-1',
        check_id: 'check-1',
        project_id: PROJECT_ID,
        prompt_id: 'prompt-1',
        platform: 'openai',
        model: 'gpt-4o-mini',
        response_text: 'Acme',
        brand_mentioned: 1,
        brand_sentiment: 'positive',
        brand_position: 1,
        competitors_mentioned: '[]',
        citations: '[]',
        brand_cited: 0,
        latency_ms: 120,
        created_at: '2026-01-01T00:01:00Z',
      },
    ]);

    const res = await request(`/v1/ai-mention/dashboard/${PROJECT_ID}`, {
      headers: sessionHeaders(),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.config.brand_name).toBe('Acme');
    expect(body.prompts).toHaveLength(1);
    expect(body.recent_checks).toHaveLength(1);
    expect(body.latest_results[0].brand_mentioned).toBe(true);
  });
});
