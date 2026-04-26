import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  betterAuthMock: vi.fn((cfg: unknown) => ({ __mock: true, cfg })),
  drizzleAdapterMock: vi.fn(() => ({ __adapter: true })),
  drizzleMock: vi.fn((d: unknown, opts: unknown) => ({ __drizzle: true, d, opts })),
}));

vi.mock('better-auth', () => ({ betterAuth: mocks.betterAuthMock }));
vi.mock('better-auth/adapters/drizzle', () => ({ drizzleAdapter: mocks.drizzleAdapterMock }));
vi.mock('drizzle-orm/d1', () => ({ drizzle: mocks.drizzleMock }));

import { createAuth } from '../index.js';

describe('createAuth', () => {
  const fakeD1 = { __d1: true };
  const schema = { user: {}, session: {}, account: {} };

  it('passes Foundry-resolved config to betterAuth', () => {
    const auth = createAuth({
      d1: fakeD1,
      schema,
      secret: 'sk',
      baseURL: 'https://x.com',
      env: 'production',
    });

    expect(auth).toBeTruthy();
    expect(mocks.drizzleMock).toHaveBeenCalledWith(fakeD1, { schema });
    expect(mocks.drizzleAdapterMock).toHaveBeenCalledWith(
      expect.objectContaining({ __drizzle: true }),
      { provider: 'sqlite', schema },
    );

    const call = mocks.betterAuthMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.secret).toBe('sk');
    expect(call.baseURL).toBe('https://x.com');
    expect((call.advanced as { useSecureCookies: boolean }).useSecureCookies).toBe(true);
  });
});
