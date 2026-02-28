import { describe, it, expect } from 'vitest';
import { request } from './helpers';

describe('Waitlist routes require auth', () => {
  it('POST /v1/waitlist without X-Project-Key returns 401', async () => {
    const res = await request('/v1/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });

  it('GET /v1/waitlist/count without X-Project-Key returns 401', async () => {
    const res = await request('/v1/waitlist/count');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });

  it('GET /v1/waitlist without Bearer token returns 401', async () => {
    const res = await request('/v1/waitlist');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('DELETE /v1/waitlist/123 without Bearer token returns 401', async () => {
    const res = await request('/v1/waitlist/123', { method: 'DELETE' });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });
});
