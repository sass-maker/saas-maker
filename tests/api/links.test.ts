import { describe, it, expect } from 'vitest';
import { request } from './helpers';

describe('Links routes require auth', () => {
  it('POST /v1/links without X-Project-Key returns 401', async () => {
    const res = await request('/v1/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: 'https://example.com' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });

  it('GET /v1/links without X-Project-Key returns 401', async () => {
    const res = await request('/v1/links');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });

  it('GET /v1/links/some-id without X-Project-Key returns 401', async () => {
    const res = await request('/v1/links/some-id');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });

  it('PATCH /v1/links/some-id without X-Project-Key returns 401', async () => {
    const res = await request('/v1/links/some-id', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: 'https://updated.com' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });

  it('DELETE /v1/links/some-id without X-Project-Key returns 401', async () => {
    const res = await request('/v1/links/some-id', { method: 'DELETE' });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });

  it('GET /v1/links/dashboard/proj-id without Bearer returns 401', async () => {
    const res = await request('/v1/links/dashboard/proj-id');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('GET /v1/links/dashboard/proj-id/stats/link-id without Bearer returns 401', async () => {
    const res = await request('/v1/links/dashboard/proj-id/stats/link-id');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });
});
