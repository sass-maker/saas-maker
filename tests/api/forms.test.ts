import { describe, it, expect } from 'vitest';
import { request } from './helpers';

describe('Forms routes require auth', () => {
  it('GET /v1/forms/dashboard/:projectId without session token returns 401', async () => {
    const res = await request('/v1/forms/dashboard/123');
    expect(res.status).toBe(401);
  });

  it('POST /v1/forms/dashboard/:projectId without session token returns 401', async () => {
    const res = await request('/v1/forms/dashboard/123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Form', slug: 'test-form' }),
    });
    expect(res.status).toBe(401);
  });

  it('GET /v1/forms/by-slug/:slug without X-Project-Key returns 401', async () => {
    const res = await request('/v1/forms/by-slug/test-form');
    expect(res.status).toBe(401);
  });

  it('POST /v1/forms/:formId/submit without X-Project-Key returns 401', async () => {
    const res = await request('/v1/forms/123/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: [] }),
    });
    expect(res.status).toBe(401);
  });
});
