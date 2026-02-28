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

describe('Analytics dashboard requires session', () => {
  it('GET /v1/analytics/overview without Bearer returns 401', async () => {
    const res = await request('/v1/analytics/overview');
    expect(res.status).toBe(401);
  });

  it('GET /v1/analytics/pages without Bearer returns 401', async () => {
    const res = await request('/v1/analytics/pages');
    expect(res.status).toBe(401);
  });

  it('GET /v1/analytics/referrers without Bearer returns 401', async () => {
    const res = await request('/v1/analytics/referrers');
    expect(res.status).toBe(401);
  });

  it('GET /v1/analytics/countries without Bearer returns 401', async () => {
    const res = await request('/v1/analytics/countries');
    expect(res.status).toBe(401);
  });

  it('GET /v1/analytics/devices without Bearer returns 401', async () => {
    const res = await request('/v1/analytics/devices');
    expect(res.status).toBe(401);
  });

  it('GET /v1/analytics/events without Bearer returns 401', async () => {
    const res = await request('/v1/analytics/events');
    expect(res.status).toBe(401);
  });
});
