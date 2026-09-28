import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = {
  getProjectByApiKey: vi.fn(),
  createFeedback: vi.fn(),
  getProjectById: vi.fn(),
  getUserById: vi.fn(),
  listFeedback: vi.fn(),
  listFeedbackStatusEvents: vi.fn(),
  updateFeedbackStatus: vi.fn(),
  getFeedbackById: vi.fn(),
  getAgentTokenByHash: vi.fn(),
  touchAgentToken: vi.fn(),
  listProjectsByOwner: vi.fn(),
};

vi.mock('../../workers/api/src/db', () => ({
  getDb: () => mockDb,
  createDatabase: () => mockDb,
}));

vi.mock('../../workers/api/src/email', () => ({
  sendNewFeedbackEmail: vi.fn(),
}));

import { request } from './helpers';

const PROJECT = {
  id: 'proj-1',
  owner_id: 'user-1',
  name: 'Acme',
  slug: 'acme',
  api_key: 'pk_test',
};

function apiKeyHeaders(extra: Record<string, string> = {}) {
  return {
    'X-Project-Key': PROJECT.api_key,
    'Content-Type': 'application/json',
    ...extra,
  };
}

beforeEach(() => {
  Object.values(mockDb).forEach((fn) => fn.mockReset());
  mockDb.getProjectByApiKey.mockResolvedValue(PROJECT);
  mockDb.createFeedback.mockImplementation(async (input) => ({
    ...input,
    submitter_name: input.submitter_name ?? null,
    upvote_count: 0,
    downvote_count: 0,
    created_at: '2026-08-20T00:00:00Z',
  }));
});

afterEach(() => vi.unstubAllGlobals());

describe('Feedback route validation with a mocked DB', () => {
  it('POST /v1/feedback with key but missing title returns 400', async () => {
    const res = await request('/v1/feedback', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({
        description: 'Broken CTA',
        submitter_email: 'me@example.com',
        type: 'bug',
      }),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/Title is required/i);
    expect(mockDb.createFeedback).not.toHaveBeenCalled();
  });

  it('POST /v1/feedback accepts an anonymous submission', async () => {
    const send = vi.fn();
    vi.stubGlobal('fetch', send);
    const res = await request('/v1/feedback', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({
        title: 'Bug report',
        description: 'Broken CTA',
        type: 'bug',
      }),
    });

    expect(res.status).toBe(201);
    expect(mockDb.createFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ submitter_email: '' })
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('emits a limited App Health event only after a durable feedback write', async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', send);

    const res = await request(
      '/v1/feedback',
      {
        method: 'POST',
        headers: apiKeyHeaders(),
        body: JSON.stringify({
          title: 'Private title',
          description: 'Private details',
          submitter_email: 'private@example.com',
          type: 'feature',
        }),
      },
      { APP_HEALTH_INGEST_KEY: 'test-ingest-key' }
    );

    expect(res.status).toBe(201);
    expect(mockDb.createFeedback).toHaveBeenCalledOnce();
    const logCalls = send.mock.calls.filter(
      ([url]) => url === 'https://ingest.sassmaker.com/v1/logs'
    );
    expect(logCalls).toHaveLength(1);
    const [url, init] = logCalls[0];
    expect(url).toBe('https://ingest.sassmaker.com/v1/logs');
    const payload = JSON.parse(init.body);
    expect(payload.logs).toHaveLength(1);
    expect(payload.logs[0]).toMatchObject({
      event: 'feedback.submitted',
      title: 'Feedback received',
      props: { project: 'acme', project_id: 'proj-1', type: 'feature' },
    });
    expect(JSON.stringify(payload)).not.toMatch(
      /Private title|Private details|private@example\.com/
    );
  });

  it('adds only the server-bound catalog ID to App Health attribution', async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', send);
    const first = vi.fn().mockResolvedValue({ catalog_project_id: 'fleet-catalog-id' });
    const bind = vi.fn(() => ({ first }));
    const db = { prepare: vi.fn(() => ({ bind })) };
    const res = await request(
      '/v1/feedback',
      {
        method: 'POST',
        headers: apiKeyHeaders(),
        body: JSON.stringify({
          title: 'Bug report',
          description: 'Broken CTA',
          type: 'bug',
          catalog_project_id: 'client-chosen-id',
        }),
      },
      { DB: db, APP_HEALTH_INGEST_KEY: 'test-ingest-key' }
    );
    expect(res.status).toBe(201);
    expect(bind).toHaveBeenCalledWith(PROJECT.id);
    const payload = JSON.parse(
      send.mock.calls.find(([url]) => url === 'https://ingest.sassmaker.com/v1/logs')![1].body
    );
    expect(payload.logs[0].props).toMatchObject({
      project: 'fleet-catalog-id',
      project_slug: PROJECT.slug,
      project_id: PROJECT.id,
      catalog_project_id: 'fleet-catalog-id',
    });
    expect(payload.logs[0].props.catalog_project_id).not.toBe('client-chosen-id');
  });

  it('keeps the submission successful when App Health delivery fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('collector unavailable')));
    const res = await request(
      '/v1/feedback',
      {
        method: 'POST',
        headers: apiKeyHeaders(),
        body: JSON.stringify({ title: 'Bug', description: 'Details', type: 'bug' }),
      },
      { APP_HEALTH_INGEST_KEY: 'test-ingest-key' }
    );
    expect(res.status).toBe(201);
  });

  it('does not emit an event if the feedback write fails', async () => {
    const send = vi.fn();
    vi.stubGlobal('fetch', send);
    mockDb.createFeedback.mockRejectedValueOnce(new Error('storage unavailable'));
    const res = await request(
      '/v1/feedback',
      {
        method: 'POST',
        headers: apiKeyHeaders(),
        body: JSON.stringify({ title: 'Bug', description: 'Details', type: 'bug' }),
      },
      { APP_HEALTH_INGEST_KEY: 'test-ingest-key' }
    );
    expect(res.status).toBe(500);
    expect(
      send.mock.calls.filter(([url]) => url === 'https://ingest.sassmaker.com/v1/logs')
    ).toHaveLength(0);
  });

  it('POST /v1/feedback stores page and pinpoint context', async () => {
    const res = await request('/v1/feedback', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({
        title: 'Broken CTA',
        description: 'Cannot click save',
        type: 'bug',
        page: { url: 'https://product.example/settings', title: 'Settings' },
        anchor: {
          selector: '#save',
          tag: 'button',
          text: 'Save',
          source: null,
          url: '/settings',
        },
        client_version: '0.4.0',
        source: 'widget',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.status).toBe('new');
    expect(body.title).toBeUndefined();
    expect(mockDb.createFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        page: { url: 'https://product.example/settings', title: 'Settings' },
        pinpoint: expect.objectContaining({ selector: '#save', tag: 'button' }),
        source: 'widget',
      })
    );
  });

  it('POST /v1/feedback accepts multipart screenshot submissions', async () => {
    const form = new FormData();
    form.append(
      'feedback',
      JSON.stringify({
        title: 'Screenshot bug',
        description: 'See image',
        type: 'bug',
      })
    );
    form.append('screenshot', new File(['image-bytes'], 'screen.png', { type: 'image/png' }));

    const res = await request('/v1/feedback', {
      method: 'POST',
      headers: { 'X-Project-Key': PROJECT.api_key },
      body: form,
    });

    expect(res.status).toBe(201);
    expect(mockDb.createFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        image_url: expect.stringMatching(/^https:\/\/images\.sassmaker\.com\/feedback\//),
      })
    );
  });

  it('POST /v1/feedback with key but invalid type returns 400', async () => {
    const res = await request('/v1/feedback', {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({
        title: 'Bug report',
        description: 'Broken CTA',
        submitter_email: 'me@example.com',
        type: 'other',
      }),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/Invalid type/i);
    expect(mockDb.createFeedback).not.toHaveBeenCalled();
  });
});
