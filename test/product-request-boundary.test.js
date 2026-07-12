import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ProductRequestError,
  authenticateProductRequest,
  authoriseProductRequest,
  productCorsHeaders,
} from '../src/product/request-boundary.js';

const fakeAdapter = { authenticate: async () => ({ subject: 'user-a', kind: 'user', provider: 'fake' }) };

test('provider-neutral identity is normalised before workspace authorisation', async () => {
  const result = await authoriseProductRequest({ request: {}, identityAdapter: fakeAdapter, workspaceId: 'workspace-a', permission: 'render:read',
    memberships: [{ subject: 'user-a', workspaceId: 'workspace-a', role: 'viewer', status: 'active' }] });
  assert.deepEqual(result.identity, { subject: 'user-a', kind: 'user', provider: 'fake' });
  await assert.rejects(() => authoriseProductRequest({ request: {}, identityAdapter: fakeAdapter, workspaceId: 'workspace-b', permission: 'render:read', memberships: [] }),
    (error) => error.code === 'RESOURCE_NOT_FOUND' && error.status === 404);
});

test('missing or malformed identity fails authentication', async () => {
  await assert.rejects(() => authenticateProductRequest({ request: {}, identityAdapter: { authenticate: async () => null } }), ProductRequestError);
  await assert.rejects(() => authenticateProductRequest({ request: {}, identityAdapter: { authenticate: async () => ({ subject: 'user-a', kind: 'unknown' }) } }), ProductRequestError);
});

test('CORS permits only exact configured HTTP(S) origins and rejects wildcard config', () => {
  assert.equal(productCorsHeaders({ requestOrigin: 'https://app.example.test', allowedOrigins: ['https://app.example.test'] })['Access-Control-Allow-Origin'], 'https://app.example.test');
  assert.throws(() => productCorsHeaders({ requestOrigin: 'https://evil.example.test', allowedOrigins: ['https://app.example.test'] }), ProductRequestError);
  assert.throws(() => productCorsHeaders({ requestOrigin: 'https://app.example.test', allowedOrigins: ['*'] }), ProductRequestError);
  assert.throws(() => productCorsHeaders({ requestOrigin: 'https://app.example.test/path', allowedOrigins: ['https://app.example.test/path'] }), ProductRequestError);
});
