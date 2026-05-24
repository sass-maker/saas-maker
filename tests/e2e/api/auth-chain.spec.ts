import { test, expect } from '@playwright/test';

const API_BASE = process.env.SAASMAKER_E2E_API_BASE?.trim() || 'https://api.sassmaker.com';
const APP_BASE = process.env.SAASMAKER_E2E_APP_BASE?.trim() || 'https://app.sassmaker.com';
const CLI_TOKEN = process.env.SAASMAKER_E2E_CLI_TOKEN?.trim();

const skipIfNoToken = CLI_TOKEN ? test : test.skip;

test.describe('Auth chain', () => {
  test('API /health returns ok', async ({ request }) => {
    const res = await request.get(`${API_BASE}/health`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  test('API rejects unauthenticated /v1/projects', async ({ request }) => {
    const res = await request.get(`${API_BASE}/v1/projects`);
    expect(res.status()).toBe(401);
  });

  test('API rejects garbage Bearer tokens', async ({ request }) => {
    const res = await request.get(`${API_BASE}/v1/projects`, {
      headers: { Authorization: 'Bearer not-a-real-token' },
    });
    expect(res.status()).toBe(401);
  });

  skipIfNoToken('API accepts CLI token (sm_*) and returns project list', async ({ request }) => {
    expect(CLI_TOKEN).toMatch(/^sm_/); // sanity — the token shape we expect
    const res = await request.get(`${API_BASE}/v1/projects`, {
      headers: { Authorization: `Bearer ${CLI_TOKEN}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('Cockpit /login renders 200', async ({ request }) => {
    const res = await request.get(`${APP_BASE}/login`);
    expect(res.status()).toBe(200);
  });

  test('Cockpit /projects redirects unauthenticated callers', async ({ request }) => {
    const res = await request.get(`${APP_BASE}/projects`, { maxRedirects: 0 });
    expect([301, 302, 307, 308]).toContain(res.status());
    const loc = res.headers()['location'] ?? '';
    expect(loc).toContain('/login');
  });

  test('Cockpit sign-in/social returns Google OAuth URL', async ({ request }) => {
    const res = await request.post(`${APP_BASE}/api/auth/sign-in/social`, {
      headers: { 'Content-Type': 'application/json' },
      data: { provider: 'google', callbackURL: '/projects' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.url).toContain('accounts.google.com');
    expect(body.url).toContain('client_id=');
    expect(body.url).toContain('redirect_uri=');
  });

  test('Cockpit ships prod API URL, not localhost:8787', async ({ request }) => {
    const res = await request.get(`${APP_BASE}/login`);
    const html = await res.text();
    expect(html).not.toContain('localhost:8787');
  });

  // Auth-gated routes redirect unauthenticated → /login
  for (const route of [
    '/projects/test-project',
    '/projects/test-project/settings',
    '/tasks',
    '/jobs',
    '/fleet',
    '/standards',
    '/cli/auth',
    '/cli/auth?code=PLACEHOLDER',
  ]) {
    test(`Cockpit ${route} redirects unauthenticated to /login`, async ({ request }) => {
      const res = await request.get(`${APP_BASE}${route}`, { maxRedirects: 0 });
      expect([301, 302, 307, 308]).toContain(res.status());
      expect(res.headers()['location'] ?? '').toContain('/login');
    });
  }

  // Public-bypass routes (per middleware) render 200 directly
  for (const route of [
    '/projects/test-project/feedback',
    '/f/test-project',
    '/t/test-project',
  ]) {
    test(`Cockpit ${route} renders publicly (no auth required)`, async ({ request }) => {
      const res = await request.get(`${APP_BASE}${route}`, { maxRedirects: 0 });
      // 200 if project exists, 404 if not — both prove the route is public.
      expect([200, 404]).toContain(res.status());
    });
  }
});
