import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../packages/cli/src/lib/config.js', () => ({
  getApiBase: vi.fn(),
  getApiKey: vi.fn(),
  getLocalProjectKey: vi.fn(),
}));

import { getApiBase, getApiKey, getLocalProjectKey } from '../../packages/cli/src/lib/config.js';
import { requestApi } from '../../packages/cli/src/lib/request.js';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('requestApi auth modes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApiBase).mockReturnValue('https://api.example.com');
    vi.mocked(getApiKey).mockReturnValue(null);
    vi.mocked(getLocalProjectKey).mockReturnValue(null);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('uses Authorization in auto mode when only token exists', async () => {
    vi.mocked(getApiKey).mockReturnValue('sm_token_123');

    await requestApi({ path: '/v1/projects', auth: 'auto' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sm_token_123');
    expect(headers['X-Project-Key']).toBeUndefined();
  });

  it('uses X-Project-Key in auto mode when only project key exists', async () => {
    vi.mocked(getLocalProjectKey).mockReturnValue('pk_project_123');

    await requestApi({ path: '/v1/feedback', auth: 'auto' });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Project-Key']).toBe('pk_project_123');
    expect(headers.Authorization).toBeUndefined();
  });

  it('throws in session mode without token', async () => {
    await expect(requestApi({ path: '/v1/projects', auth: 'session' })).rejects.toThrow(
      'No session token found. Run `saasmaker login` first.'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws in project mode without project key', async () => {
    await expect(requestApi({ path: '/v1/feedback', auth: 'project' })).rejects.toThrow(
      'No project key found. Run `saasmaker init` first or pass --project-key.'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws in auto mode when no auth context exists', async () => {
    await expect(requestApi({ path: '/v1/projects', auth: 'auto' })).rejects.toThrow(
      'No auth context found. Run `saasmaker login` and/or `saasmaker init`.'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
