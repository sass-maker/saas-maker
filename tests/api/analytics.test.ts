import { describe, it, expect } from 'vitest';
import { request } from './helpers';

describe('Analytics ingestion requires API key', () => {
  it('POST /v1/analytics/events without X-Project-Key returns 401', async () => {
    const res = await request('/v1/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });
});
