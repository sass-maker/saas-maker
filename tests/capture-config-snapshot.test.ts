import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { publicConfig, refreshConfigs } from '../scripts/refresh-capture-config.mjs';

const config = { api_key: 'pk_example', name: 'Example', slug: 'example' };

describe('build-time capture configuration', () => {
  it('ships only validated public fields for configured products', () => {
    const snapshot = JSON.parse(
      readFileSync(
        new URL('../packages/newsletter-capture/src/capture-config.json', import.meta.url),
        'utf8'
      )
    );
    expect(snapshot['saas-maker']).toBeDefined();
    for (const [id, value] of Object.entries(snapshot)) {
      expect(id).toMatch(/^[a-z][a-z0-9_-]{0,63}$/);
      expect(publicConfig(value)).toEqual(value);
    }
  });

  it('refreshes public config without cookies and strips extra provider fields', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ ...config, owner_email: 'private@example.test' })
    );
    expect(await refreshConfigs(['example', 'example'], {}, fetcher)).toEqual({ example: config });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: 'omit', cache: 'no-store' });
  });

  it('does not erase previously configured products on a 404 or provider failure', async () => {
    await expect(
      refreshConfigs(
        ['example'],
        { example: config },
        async () => new Response(null, { status: 404 })
      )
    ).rejects.toThrow('HTTP 404');
    await expect(
      refreshConfigs(['example'], {}, async () => new Response(null, { status: 503 }))
    ).rejects.toThrow('HTTP 503');
  });

  it('rejects unsafe keys and skips only newly unbound products', async () => {
    expect(() => publicConfig({ ...config, api_key: 'private_token' })).toThrow();
    expect(
      await refreshConfigs(['example', 'unbound'], {}, async (url: string) =>
        url.endsWith('/unbound') ? new Response(null, { status: 404 }) : Response.json(config)
      )
    ).toEqual({ example: config });
  });
});
