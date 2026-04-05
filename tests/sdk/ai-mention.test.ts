import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIMentionService } from '../../packages/sdk/src/services/ai-mention';

function createMockHttp() {
  return {
    request: vi.fn(),
    requestRaw: vi.fn(),
  } as any;
}

describe('AIMentionService', () => {
  let aiMention: AIMentionService;
  let http: ReturnType<typeof createMockHttp>;

  beforeEach(() => {
    http = createMockHttp();
    aiMention = new AIMentionService(http);
  });

  it('uses session auth to fetch config', async () => {
    http.request.mockResolvedValue(null);

    await aiMention.getConfig('proj 123');

    expect(http.request).toHaveBeenCalledWith(
      'GET',
      '/v1/ai-mention/config/proj%20123',
      undefined,
      { auth: 'session' }
    );
  });

  it('uses session auth to save config', async () => {
    http.request.mockResolvedValue({ id: 'cfg_1' });

    await aiMention.saveConfig('proj_123', {
      brand_name: 'Acme',
      platforms: ['openai'],
      openai_api_key: 'sk-test',
    });

    expect(http.request).toHaveBeenCalledWith(
      'POST',
      '/v1/ai-mention/config/proj_123',
      {
        brand_name: 'Acme',
        platforms: ['openai'],
        openai_api_key: 'sk-test',
      },
      { auth: 'session' }
    );
  });

  it('uses session auth for check history endpoints', async () => {
    http.request.mockResolvedValue([]);

    await aiMention.listChecks('proj_123');
    await aiMention.getCheck('proj_123', 'check_456');

    expect(http.request).toHaveBeenNthCalledWith(
      1,
      'GET',
      '/v1/ai-mention/checks/proj_123',
      undefined,
      { auth: 'session' }
    );
    expect(http.request).toHaveBeenNthCalledWith(
      2,
      'GET',
      '/v1/ai-mention/checks/proj_123/check_456',
      undefined,
      { auth: 'session' }
    );
  });
});
