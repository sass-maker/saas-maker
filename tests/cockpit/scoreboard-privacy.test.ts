import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../../apps/cockpit/src/middleware';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('private scoreboard request boundary', () => {
  it('requires an existing session on the hosted scoreboard', async () => {
    vi.stubEnv('LOCAL_AUTH_BYPASS', 'false');
    const result = await middleware(
      new NextRequest('https://app.example.com/projects?view=scoreboard')
    );
    expect(result.status).toBe(307);
    expect(result.headers.get('location')).toBe(
      'https://app.example.com/login?returnTo=scoreboard'
    );
  });
  it('marks only the private view, disables cross-origin connections and prevents caching', async () => {
    vi.stubEnv('LOCAL_AUTH_BYPASS', 'false');
    const request = new NextRequest('https://app.example.com/projects?view=scoreboard', {
      headers: { cookie: 'better-auth.session_token=synthetic' },
    });
    const result = await middleware(request);
    expect(result.headers.get('x-middleware-request-x-saasmaker-private-surface')).toBe(
      'scoreboard'
    );
    expect(result.headers.get('content-security-policy')).toContain("connect-src 'self'");
    expect(result.headers.get('cache-control')).toBe('private, no-store');
    expect(result.headers.get('referrer-policy')).toBe('no-referrer');
    const ordinary = await middleware(
      new NextRequest('https://app.example.com/projects', {
        headers: {
          cookie: 'better-auth.session_token=synthetic',
          'x-saasmaker-private-surface': 'scoreboard',
        },
      })
    );
    expect(ordinary.headers.get('x-middleware-request-x-saasmaker-private-surface')).toBeNull();
    expect(ordinary.headers.get('content-security-policy')).toBeNull();
  });
});
