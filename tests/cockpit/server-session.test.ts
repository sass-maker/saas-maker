import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  headers: vi.fn(async () => new Headers({ host: 'dashboard.example' })),
  getSession: vi.fn(),
  getLocalDevSession: vi.fn(),
  isLocalAuthBypassEnabled: vi.fn(() => false),
}));

vi.mock('../../apps/cockpit/node_modules/next/headers.js', () => ({ headers: mocks.headers }));
vi.mock('../../apps/cockpit/src/lib/auth', () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock('../../apps/cockpit/src/lib/local-auth', () => ({
  getLocalDevSession: mocks.getLocalDevSession,
  isLocalAuthBypassEnabled: mocks.isLocalAuthBypassEnabled,
}));

import { getDashboardSession } from '../../apps/cockpit/src/lib/server-session';

let requestHeaders: Headers;

describe('dashboard session lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestHeaders = new Headers({ host: 'dashboard.example' });
    mocks.headers.mockResolvedValue(requestHeaders);
    mocks.isLocalAuthBypassEnabled.mockReturnValue(false);
    mocks.getSession.mockResolvedValue({ user: { id: 'account' } });
    mocks.getLocalDevSession.mockReturnValue({ user: { id: 'local-dev' } });
  });

  it('uses request headers for the authenticated session lookup', async () => {
    expect(await getDashboardSession()).toEqual({ user: { id: 'account' } });
    expect(mocks.isLocalAuthBypassEnabled).toHaveBeenCalledWith('dashboard.example');
    expect(mocks.getSession).toHaveBeenCalledWith({ headers: requestHeaders });
    expect(mocks.headers).toHaveBeenCalledOnce();
    expect(mocks.getLocalDevSession).not.toHaveBeenCalled();
  });

  it('preserves the explicit local development auth bypass', async () => {
    mocks.isLocalAuthBypassEnabled.mockReturnValue(true);

    expect(await getDashboardSession()).toEqual({ user: { id: 'local-dev' } });
    expect(mocks.getLocalDevSession).toHaveBeenCalledOnce();
    expect(mocks.getSession).not.toHaveBeenCalled();
  });
});
