import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const captureMock = vi.fn();
  const identifyMock = vi.fn();
  const flushMock = vi.fn(async () => undefined);
  const shutdownMock = vi.fn(async () => undefined);
  class MockPostHog {
    capture = captureMock;
    identify = identifyMock;
    flush = flushMock;
    shutdown = shutdownMock;
    constructor(_apiKey: string, _opts?: unknown) {}
  }
  return { captureMock, identifyMock, flushMock, shutdownMock, MockPostHog };
});

vi.mock('posthog-node', () => ({ PostHog: mocks.MockPostHog }));

import {
  createPostHogServer,
  trackServer,
  identifyServer,
  flushServer,
  shutdownServer,
} from '../server.js';
import type { BaseEventMap } from '../types.js';

beforeEach(async () => {
  await shutdownServer();
  mocks.captureMock.mockReset();
  mocks.identifyMock.mockReset();
  mocks.flushMock.mockClear();
});

describe('server client', () => {
  it('creates a posthog-node instance with sane defaults', () => {
    const c = createPostHogServer({ apiKey: 'phc_srv' });
    expect(c).toBeInstanceOf(mocks.MockPostHog);
  });

  it('trackServer forwards distinctId + event + properties', () => {
    createPostHogServer({ apiKey: 'phc_srv' });
    interface E extends BaseEventMap {
      project_created: { project_id: string };
    }
    trackServer<E>('project_created', {
      distinctId: 'user-9',
      properties: { project_id: 'p9' },
    });
    expect(mocks.captureMock).toHaveBeenCalledWith({
      distinctId: 'user-9',
      event: 'project_created',
      properties: { project_id: 'p9' },
      groups: undefined,
    });
  });

  it('identifyServer forwards distinctId + properties', () => {
    createPostHogServer({ apiKey: 'phc_srv' });
    identifyServer('user-1', { plan: 'pro' });
    expect(mocks.identifyMock).toHaveBeenCalledWith({
      distinctId: 'user-1',
      properties: { plan: 'pro' },
    });
  });

  it('trackServer no-ops if not initialized', () => {
    trackServer('foo', { distinctId: 'x' });
    expect(mocks.captureMock).not.toHaveBeenCalled();
  });

  it('flushServer awaits posthog.flush', async () => {
    createPostHogServer({ apiKey: 'phc_srv' });
    await flushServer();
    expect(mocks.flushMock).toHaveBeenCalled();
  });
});
