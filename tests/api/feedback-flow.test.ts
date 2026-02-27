import { describe, it, expect } from 'vitest';
import { request } from './helpers';

// ---------------------------------------------------------------------------
// These tests exercise auth guards and input validation using Hono's built-in
// app.request() helper. Middleware rejects requests that are missing headers
// or Bearer tokens BEFORE any database call, so these run without a live
// CockroachDB instance.
// ---------------------------------------------------------------------------

describe('Health check', () => {
  it('GET /health returns { status: "ok" }', async () => {
    const res = await request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });
});

describe('Feedback submission validation', () => {
  it('POST /v1/feedback without X-Project-Key returns 401', async () => {
    const res = await request('/v1/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Bug', description: 'broken', submitter_email: 'a@b.com', type: 'bug' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });
});

describe('Feedback list validation', () => {
  it('GET /v1/feedback without X-Project-Key returns 401', async () => {
    const res = await request('/v1/feedback');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });
});

describe('Upvote requires auth', () => {
  it('POST /v1/feedback/123/upvote without Bearer token returns 401', async () => {
    const res = await request('/v1/feedback/123/upvote', { method: 'POST' });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('DELETE /v1/feedback/123/upvote without Bearer token returns 401', async () => {
    const res = await request('/v1/feedback/123/upvote', { method: 'DELETE' });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });
});

describe('Project routes require auth', () => {
  it('GET /v1/projects without auth returns 401', async () => {
    const res = await request('/v1/projects');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('POST /v1/projects without auth returns 401', async () => {
    const res = await request('/v1/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('PATCH /v1/projects/123 without auth returns 401', async () => {
    const res = await request('/v1/projects/123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('DELETE /v1/projects/123 without auth returns 401', async () => {
    const res = await request('/v1/projects/123', { method: 'DELETE' });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });
});

describe('Dashboard feedback routes require auth', () => {
  it('GET /v1/feedback/inbox/123 without auth returns 401', async () => {
    const res = await request('/v1/feedback/inbox/123');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('PATCH /v1/feedback/123 without auth returns 401', async () => {
    const res = await request('/v1/feedback/123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('DELETE /v1/feedback/123 without auth returns 401', async () => {
    const res = await request('/v1/feedback/123', { method: 'DELETE' });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });
});

describe('Upload validation', () => {
  it('POST /v1/upload without X-Project-Key returns 401', async () => {
    const res = await request('/v1/upload', { method: 'POST' });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });
});

describe('Auth endpoints', () => {
  it('GET /v1/auth/session without Bearer token returns 401', async () => {
    const res = await request('/v1/auth/session');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
  });

  it('POST /v1/auth/logout returns ok (no-op)', async () => {
    const res = await request('/v1/auth/logout', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// DB-dependent tests: only run when DATABASE_URL is set and a real CockroachDB
// instance is reachable. These are skipped by default in CI.
// ---------------------------------------------------------------------------
describe.skipIf(!process.env.DATABASE_URL)('DB-dependent: feedback submission validation', () => {
  // These tests require passing through requireApiKey which calls getDb().
  // They would only work with a live database that has a valid project/API key.
  it.todo('POST /v1/feedback with key but missing title returns 400');
  it.todo('POST /v1/feedback with key but missing email returns 400');
  it.todo('POST /v1/feedback with key but invalid type returns 400');
  it.todo('GET /v1/feedback?type=invalid returns 400');
});
