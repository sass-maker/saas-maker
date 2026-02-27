import { describe, it, expect } from 'vitest';
import { request } from './helpers';

describe('Index routes require API key', () => {
  it('POST /v1/indexes without X-Project-Key returns 401', async () => {
    const res = await request('/v1/indexes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test-index' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });

  it('GET /v1/indexes without X-Project-Key returns 401', async () => {
    const res = await request('/v1/indexes');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });

  it('DELETE /v1/indexes/123 without X-Project-Key returns 401', async () => {
    const res = await request('/v1/indexes/123', { method: 'DELETE' });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });
});

describe('Document routes require API key', () => {
  it('POST /v1/indexes/123/documents without X-Project-Key returns 401', async () => {
    const res = await request('/v1/indexes/123/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'test' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });

  it('GET /v1/indexes/123/documents without X-Project-Key returns 401', async () => {
    const res = await request('/v1/indexes/123/documents');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });

  it('DELETE /v1/indexes/123/documents/456 without X-Project-Key returns 401', async () => {
    const res = await request('/v1/indexes/123/documents/456', { method: 'DELETE' });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });
});

describe('Search routes require API key', () => {
  it('POST /v1/indexes/123/search without X-Project-Key returns 401', async () => {
    const res = await request('/v1/indexes/123/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });
});
