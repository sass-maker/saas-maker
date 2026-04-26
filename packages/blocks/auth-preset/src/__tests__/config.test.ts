import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveAuthConfig } from '../config.js';

const originalEnv = { ...process.env };

beforeEach(() => {
  // Clear env between tests
  for (const k of Object.keys(process.env)) {
    if (
      k.startsWith('AUTH_') ||
      k.startsWith('BETTER_AUTH_') ||
      k.startsWith('GOOGLE_') ||
      k === 'NODE_ENV' ||
      k === 'NEXTAUTH_URL'
    ) {
      delete process.env[k];
    }
  }
});

afterEach(() => {
  for (const [k, v] of Object.entries(originalEnv)) {
    if (v !== undefined) process.env[k] = v;
  }
});

describe('resolveAuthConfig', () => {
  const baseOpts = {
    d1: {} as unknown,
    schema: {} as Record<string, unknown>,
    secret: 'sk',
    baseURL: 'https://app.example.com',
  };

  it('returns secret + baseURL from opts', () => {
    const cfg = resolveAuthConfig(baseOpts);
    expect(cfg.secret).toBe('sk');
    expect(cfg.baseURL).toBe('https://app.example.com');
  });

  it('falls back to env when secret omitted', () => {
    process.env.BETTER_AUTH_SECRET = 'env-secret';
    const cfg = resolveAuthConfig({ ...baseOpts, secret: undefined });
    expect(cfg.secret).toBe('env-secret');
  });

  it('throws when neither secret nor env provided', () => {
    expect(() => resolveAuthConfig({ ...baseOpts, secret: undefined })).toThrow(/missing secret/);
  });

  it('throws when neither baseURL nor env provided', () => {
    expect(() => resolveAuthConfig({ ...baseOpts, baseURL: undefined })).toThrow(/missing baseURL/);
  });

  it('reads google creds from env', () => {
    process.env.GOOGLE_CLIENT_ID = 'gid';
    process.env.GOOGLE_CLIENT_SECRET = 'gsec';
    const cfg = resolveAuthConfig(baseOpts);
    expect(cfg.socialProviders.google).toEqual({ clientId: 'gid', clientSecret: 'gsec' });
  });

  it('uses opt-supplied google creds over env', () => {
    process.env.GOOGLE_CLIENT_ID = 'env-id';
    const cfg = resolveAuthConfig({
      ...baseOpts,
      google: { clientId: 'opt-id', clientSecret: 'opt-sec' },
    });
    expect(cfg.socialProviders.google.clientId).toBe('opt-id');
  });

  it('defaults trustedOrigins to [baseURL]', () => {
    const cfg = resolveAuthConfig(baseOpts);
    expect(cfg.trustedOrigins).toEqual(['https://app.example.com']);
  });

  it('uses non-secure cookies in development', () => {
    const cfg = resolveAuthConfig({ ...baseOpts, env: 'development' });
    expect(cfg.advanced.useSecureCookies).toBe(false);
    expect(cfg.advanced.cookies.session_token.attributes.secure).toBe(false);
  });

  it('uses secure cookies in production', () => {
    const cfg = resolveAuthConfig({ ...baseOpts, env: 'production' });
    expect(cfg.advanced.useSecureCookies).toBe(true);
    expect(cfg.advanced.cookies.session_token.attributes.secure).toBe(true);
  });

  it('respects custom session cookie name', () => {
    const cfg = resolveAuthConfig({ ...baseOpts, sessionCookieName: 'my.session' });
    expect(cfg.advanced.cookies.session_token.name).toBe('my.session');
  });

  it('default session cookie name is foundry.session', () => {
    const cfg = resolveAuthConfig(baseOpts);
    expect(cfg.advanced.cookies.session_token.name).toBe('foundry.session');
  });
});
