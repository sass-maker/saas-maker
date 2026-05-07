import { describe, it, expect } from 'vitest';
import { request } from './helpers';

describe('Knowledge Base routes require auth', () => {
  it('POST /v1/knowledge/indexes without session token returns 401', async () => {
    const res = await request('/v1/knowledge/indexes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Index', project_id: '123' }),
    });
    expect(res.status).toBe(401);
  });

  it('GET /v1/knowledge/indexes without session token returns 401', async () => {
    const res = await request('/v1/knowledge/indexes?project_id=123');
    expect(res.status).toBe(401);
  });

  it('POST /v1/knowledge/indexes/:id/documents without auth returns 401', async () => {
    const res = await request('/v1/knowledge/indexes/123/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'test content' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /v1/knowledge/indexes/:id/search without auth returns 401', async () => {
    const res = await request('/v1/knowledge/indexes/123/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test' }),
    });
    expect(res.status).toBe(401);
  });
});
