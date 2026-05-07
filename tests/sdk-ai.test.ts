import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SaaSMakerClient } from '../packages/blocks/sdk/src/client';

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('SaaSMakerClient AI service', () => {
  it('sends chat completions through the project-authenticated AI gateway', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'chatcmpl_test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new SaaSMakerClient({
      apiKey: 'pk_test',
      baseUrl: 'https://api.test',
    });

    await client.ai.chatCompletions({
      messages: [{ role: 'user', content: 'Ship it' }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/v1/ai/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Project-Key': 'pk_test',
        }),
      }),
    );
  });

  it('uses session auth for owner config reads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ai_base_url: 'https://api.openai.com/v1',
          ai_model: 'gpt-4o-mini',
          ai_api_key_configured: true,
          ai_api_key_preview: 'sk-t...test',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new SaaSMakerClient({
      sessionToken: 'sm_session',
      baseUrl: 'https://api.test',
    });

    await client.ai.getConfig('proj-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/v1/ai/config?project_id=proj-1',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer sm_session',
        }),
      }),
    );
  });
});
