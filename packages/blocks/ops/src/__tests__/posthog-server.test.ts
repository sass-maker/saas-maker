import { afterEach, describe, expect, it, vi } from 'vitest';
import { capture, configurePostHog, flushPostHog } from '../posthog-server.js';

describe('PostHog server capture', () => {
  afterEach(async () => {
    await flushPostHog();
    vi.restoreAllMocks();
  });

  it('maps legacy project identity keys to project_id on capture', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    configurePostHog('test-key');

    capture({
      distinctId: 'user-1',
      event: 'task_created',
      properties: { project_slug: 'saas-maker', task_id: 't-1' },
    });

    await flushPostHog();

    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.properties).toEqual({
      project_id: 'saas-maker',
      task_id: 't-1',
    });
  });
});
