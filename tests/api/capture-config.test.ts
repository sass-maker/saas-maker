import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDb, mockBinding } = vi.hoisted(() => ({
  mockDb: { getProjectById: vi.fn() },
  mockBinding: { getSaasMakerProjectIdByCatalogId: vi.fn() },
}));
vi.mock('../../workers/api/src/db', () => ({ getDb: () => mockDb }));
vi.mock('../../workers/api/src/lib/catalog-project-binding', () => mockBinding);

import { request } from './helpers';

beforeEach(() => {
  mockDb.getProjectById.mockReset();
  mockBinding.getSaasMakerProjectIdByCatalogId.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

const BOUND_PROJECT = {
  id: 'saas-project-1',
  name: 'Acme',
  slug: 'acme',
  api_key: 'pk_acme_publishable',
  owner_id: 'owner-1',
  readme: 'private readme',
  source: 'dashboard',
  created_at: '2026-01-01T00:00:00Z',
};

describe('GET /v1/capture-config/:catalogId', () => {
  it('returns only the publishable key and minimal display metadata for a bound catalog id', async () => {
    mockBinding.getSaasMakerProjectIdByCatalogId.mockResolvedValue('saas-project-1');
    mockDb.getProjectById.mockResolvedValue(BOUND_PROJECT);
    const response = await request('/v1/capture-config/acme', undefined, { DB: {} });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ api_key: 'pk_acme_publishable', name: 'Acme', slug: 'acme' });
    // Privacy: no owner, readme, source, timestamps, or internal project id leak.
    expect(JSON.stringify(body)).not.toMatch(/owner-1|private readme|saas-project-1|dashboard/);
    expect(mockBinding.getSaasMakerProjectIdByCatalogId).toHaveBeenCalledWith({}, 'acme');
    expect(mockDb.getProjectById).toHaveBeenCalledWith('saas-project-1');
  });

  it('sets a bounded public cache and reflects an HTTPS web origin without credentials', async () => {
    mockBinding.getSaasMakerProjectIdByCatalogId.mockResolvedValue('saas-project-1');
    mockDb.getProjectById.mockResolvedValue(BOUND_PROJECT);
    const origin = 'https://an-independent-product.example';
    const response = await request(
      '/v1/capture-config/acme',
      {
        headers: { Origin: origin },
      },
      { DB: {} }
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=60, s-maxage=300');
    expect(response.headers.get('vary')).toContain('Origin');
    expect(response.headers.get('access-control-allow-origin')).toBe(origin);
    expect(response.headers.get('access-control-allow-credentials')).toBeNull();
  });

  it('allows a CORS preflight from an HTTPS web origin', async () => {
    const origin = 'https://shop.example';
    const preflight = await request('/v1/capture-config/acme', {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
      },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe(origin);
    expect(preflight.headers.get('access-control-allow-methods')).toContain('GET');
    expect(preflight.headers.get('access-control-allow-credentials')).toBeNull();
  });

  it('404s for an unknown (unbound) catalog id without leaking existence', async () => {
    mockBinding.getSaasMakerProjectIdByCatalogId.mockResolvedValue(null);
    const response = await request('/v1/capture-config/not-bound', undefined, { DB: {} });
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe('not_found');
    expect(mockDb.getProjectById).not.toHaveBeenCalled();
  });

  it('404s with the same shape for a malformed catalog id, before any DB access', async () => {
    const response = await request('/v1/capture-config/..%2Fadmin', undefined, { DB: {} });
    expect(response.status).toBe(404);
    expect(mockBinding.getSaasMakerProjectIdByCatalogId).not.toHaveBeenCalled();
    expect(mockDb.getProjectById).not.toHaveBeenCalled();
  });

  it('404s when the binding exists but the bound project is gone', async () => {
    mockBinding.getSaasMakerProjectIdByCatalogId.mockResolvedValue('saas-project-1');
    mockDb.getProjectById.mockResolvedValue(null);
    const response = await request('/v1/capture-config/acme', undefined, { DB: {} });
    expect(response.status).toBe(404);
  });

  it('does not open credentialed owner CORS for the public config read', async () => {
    mockBinding.getSaasMakerProjectIdByCatalogId.mockResolvedValue('saas-project-1');
    mockDb.getProjectById.mockResolvedValue(BOUND_PROJECT);
    // An origin outside the owner allowlist but still a valid HTTPS web origin
    // must be allowed noncredentialed; an owner-style credentialed response is not.
    const origin = 'https://random-shop.example';
    const response = await request(
      '/v1/capture-config/acme',
      {
        headers: { Origin: origin },
      },
      { DB: {} }
    );
    expect(response.headers.get('access-control-allow-origin')).toBe(origin);
    expect(response.headers.get('access-control-allow-credentials')).toBeNull();
  });
});
