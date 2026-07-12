import { authoriseWorkspaceAccess } from './authorisation.js';

export async function authenticateProductRequest({ request, identityAdapter }) {
  if (!identityAdapter?.authenticate || !request) throw new ProductRequestError('identity adapter is required', 401);
  const identity = await identityAdapter.authenticate(request);
  if (!identity?.subject || !identity.kind || !['user', 'service'].includes(identity.kind)) {
    throw new ProductRequestError('authentication required', 401);
  }
  return Object.freeze({ subject: identity.subject, kind: identity.kind, provider: identity.provider ?? 'adapter' });
}

export async function authoriseProductRequest({ request, identityAdapter, workspaceId, permission, memberships }) {
  const identity = await authenticateProductRequest({ request, identityAdapter });
  const membership = authoriseWorkspaceAccess({ identity, workspaceId, permission, memberships });
  return Object.freeze({ identity, membership });
}

export function productCorsHeaders({ requestOrigin, allowedOrigins }) {
  if (!requestOrigin) return Object.freeze({ Vary: 'Origin' });
  if (!Array.isArray(allowedOrigins) || allowedOrigins.includes('*')) {
    throw new ProductRequestError('an explicit customer-app origin allowlist is required', 500);
  }
  const normalized = allowedOrigins.map(normalizeOrigin);
  const origin = normalizeOrigin(requestOrigin);
  if (!normalized.includes(origin)) throw new ProductRequestError('origin not allowed', 403);
  return Object.freeze({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    Vary: 'Origin',
  });
}

export class ProductRequestError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ProductRequestError';
    this.code = status === 401 ? 'AUTHENTICATION_REQUIRED' : 'REQUEST_BOUNDARY_REJECTED';
    this.status = status;
  }
}

function normalizeOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ProductRequestError('valid origin is required', 403);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new ProductRequestError('valid HTTP(S) origin is required', 403);
  }
  return url.origin;
}
