import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpClient, SaaSMakerError } from '../../packages/blocks/sdk/src/http';

const fetchMock = vi.fn();

describe('HttpClient auth modes', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends X-Project-Key by default', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const http = new HttpClient('https://api.sassmaker.com', 'pk_test');
    await http.request('GET', '/v1/feedback');

    expect(fetchMock).toHaveBeenCalledWith('https://api.sassmaker.com/v1/feedback', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Project-Key': 'pk_test',
      },
      body: undefined,
    });
  });

  it('sends Authorization header for session-authenticated requests', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const http = new HttpClient('https://api.sassmaker.com', 'pk_test', 'sm_session_token');
    await http.request('GET', '/v1/projects', undefined, { auth: 'session' });

    expect(fetchMock).toHaveBeenCalledWith('https://api.sassmaker.com/v1/projects', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sm_session_token',
      },
      body: undefined,
    });
  });

  it('throws a helpful error when session auth is requested without a session token', async () => {
    const http = new HttpClient('https://api.sassmaker.com', 'pk_test');

    await expect(
      http.request('GET', '/v1/projects', undefined, { auth: 'session' })
    ).rejects.toMatchObject(
      new SaaSMakerError('Session token is required for session-authenticated endpoints', 401)
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
