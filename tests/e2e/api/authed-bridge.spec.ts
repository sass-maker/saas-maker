import { test, expect, type APIRequestContext } from '@playwright/test';

const API_BASE = process.env.SAASMAKER_E2E_API_BASE?.trim() || 'https://api.sassmaker.com';
const E2E_SECRET = process.env.FOUNDRY_E2E_SECRET?.trim();

const skipIfNoSecret = E2E_SECRET ? test : test.skip;

async function mintSession(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post(`${API_BASE}/v1/test/mint-session`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Foundry-Test-Secret': E2E_SECRET ?? '',
    },
    data: { email },
  });
  if (!res.ok()) throw new Error(`mint-session failed: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  return body.token as string;
}

async function cleanup(request: APIRequestContext) {
  await request.delete(`${API_BASE}/v1/test/cleanup`, {
    headers: { 'X-Foundry-Test-Secret': E2E_SECRET ?? '' },
  });
}

test.describe('Authed bridge (better-auth → workers/api)', () => {
  test.afterAll(async ({ request }) => {
    if (E2E_SECRET) await cleanup(request);
  });

  skipIfNoSecret('Mint endpoint refuses non-e2e email patterns', async ({ request }) => {
    const res = await request.post(`${API_BASE}/v1/test/mint-session`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Foundry-Test-Secret': E2E_SECRET ?? '',
      },
      data: { email: 'real-user@example.com' },
    });
    expect(res.status()).toBe(400);
  });

  skipIfNoSecret('Mint endpoint rejects bad secret with 401', async ({ request }) => {
    const res = await request.post(`${API_BASE}/v1/test/mint-session`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Foundry-Test-Secret': 'definitely-wrong',
      },
      data: { email: 'e2e-noop@e2e.foundry.test' },
    });
    expect(res.status()).toBe(401);
  });

  skipIfNoSecret('API requireSession resolves better-auth opaque tokens', async ({ request }) => {
    const token = await mintSession(request, 'e2e-bridge-1@e2e.foundry.test');

    const res = await request.get(`${API_BASE}/v1/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  skipIfNoSecret('Minted session also resolves on /v1/standards/<type>', async ({ request }) => {
    const token = await mintSession(request, 'e2e-bridge-2@e2e.foundry.test');

    const res = await request.get(`${API_BASE}/v1/standards/next`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('eslint_rules');
  });

  skipIfNoSecret('Expired or invalid bat_ tokens are rejected', async ({ request }) => {
    const res = await request.get(`${API_BASE}/v1/projects`, {
      headers: { Authorization: 'Bearer bat_invalid_token_should_404' },
    });
    expect(res.status()).toBe(401);
  });
});
