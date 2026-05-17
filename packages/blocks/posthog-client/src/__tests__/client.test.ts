import { describe, it, expect, beforeEach, vi } from 'vitest';

const { captureMock, identifyMock, initMock, registerMock, resetMock } = vi.hoisted(() => ({
  captureMock: vi.fn(),
  identifyMock: vi.fn(),
  initMock: vi.fn(),
  registerMock: vi.fn(),
  resetMock: vi.fn(),
}));

vi.mock('posthog-js', () => ({
  default: {
    init: initMock,
    register: registerMock,
    capture: captureMock,
    identify: identifyMock,
    reset: resetMock,
  },
}));

import {
  initPostHog,
  track,
  identify,
  reset,
  __resetForTests,
  getPostHog,
} from '../client.js';
import type { BaseEventMap } from '../types.js';

beforeEach(() => {
  __resetForTests();
  captureMock.mockReset();
  identifyMock.mockReset();
  initMock.mockReset();
  registerMock.mockReset();
  resetMock.mockReset();
});

describe('client.initPostHog', () => {
  it('initializes posthog-js with apiKey + defaults', () => {
    initPostHog({ apiKey: 'phc_test' });
    expect(initMock).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        api_host: 'https://us.i.posthog.com',
        autocapture: false,
      }),
    );
  });

  it('respects custom host + autocapture', () => {
    initPostHog({ apiKey: 'phc_test', host: 'https://eu.posthog.com', autocapture: true });
    expect(initMock).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({ api_host: 'https://eu.posthog.com', autocapture: true }),
    );
  });

  it('registers super properties when provided', () => {
    initPostHog({ apiKey: 'phc_test', superProperties: { env: 'prod' } });
    expect(registerMock).toHaveBeenCalledWith({ env: 'prod' });
  });

  it('does nothing when disabled', () => {
    initPostHog({ apiKey: 'phc_test', disabled: true });
    expect(initMock).not.toHaveBeenCalled();
    expect(getPostHog()).toBeNull();
  });

  it('uses the fleet key fallback without apiKey', () => {
    initPostHog({});
    expect(initMock).toHaveBeenCalledWith(
      'phc_qgiAarw4Co4pw9fz3Fxj4UJaHmqzFetqs4JrXhGc35Nd',
      expect.objectContaining({
        api_host: 'https://us.i.posthog.com',
        autocapture: false,
      }),
    );
  });

  it('only initializes once', () => {
    initPostHog({ apiKey: 'phc_test' });
    initPostHog({ apiKey: 'phc_test' });
    expect(initMock).toHaveBeenCalledTimes(1);
  });
});

describe('track / identify / reset', () => {
  beforeEach(() => initPostHog({ apiKey: 'phc_test' }));

  it('forwards event + properties to posthog.capture', () => {
    interface E extends BaseEventMap {
      feedback_submitted: { project_id: string };
    }
    track<E>('feedback_submitted', { project_id: 'p1' });
    expect(captureMock).toHaveBeenCalledWith('feedback_submitted', { project_id: 'p1' });
  });

  it('identify forwards to posthog.identify', () => {
    identify('user-1', { plan: 'pro' });
    expect(identifyMock).toHaveBeenCalledWith('user-1', { plan: 'pro' });
  });

  it('reset clears identity', () => {
    reset();
    expect(resetMock).toHaveBeenCalled();
  });

  it('track no-ops if not initialized', () => {
    __resetForTests();
    captureMock.mockReset();
    track('foo');
    expect(captureMock).not.toHaveBeenCalled();
  });
});
