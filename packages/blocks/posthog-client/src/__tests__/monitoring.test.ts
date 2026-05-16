import { beforeEach, describe, expect, it, vi } from 'vitest';

const { captureMock, initMock, registerMock } = vi.hoisted(() => ({
  captureMock: vi.fn(),
  initMock: vi.fn(),
  registerMock: vi.fn(),
}));

vi.mock('posthog-js', () => ({
  default: {
    init: initMock,
    register: registerMock,
    capture: captureMock,
    identify: vi.fn(),
    reset: vi.fn(),
  },
}));

import { __resetForTests, initPostHog } from '../client.js';
import {
  captureAuthFailure,
  capturePageCrash,
  captureSignupFailure,
  installBrowserMonitoring,
  sanitizeMonitoringProperties,
} from '../monitoring.js';

beforeEach(() => {
  __resetForTests();
  captureMock.mockReset();
  initMock.mockReset();
  registerMock.mockReset();
});

describe('monitoring helpers', () => {
  it('no-ops safely when PostHog is not configured', () => {
    expect(() => {
      installBrowserMonitoring();
      capturePageCrash(new Error('boom'), { projectSlug: 'reader' });
      captureAuthFailure({ projectSlug: 'reader', stage: 'signin', reason: 'missing provider' });
    }).not.toThrow();

    expect(initMock).not.toHaveBeenCalled();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('captures manual page crashes with sanitized context', () => {
    initPostHog({ apiKey: 'phc_test' });
    capturePageCrash(new Error('chunk failed'), {
      projectSlug: 'significanthobbies',
      environment: 'production',
      release: 'abc123',
      route: 'https://significanthobbies.com/explore?token=secret',
      extra: {
        chunk: '5314',
        authToken: 'do-not-send',
      },
    });

    expect(captureMock).toHaveBeenCalledWith(
      'foundry_page_crash',
      expect.objectContaining({
        project_slug: 'significanthobbies',
        environment: 'production',
        release: 'abc123',
        route: 'https://significanthobbies.com/explore',
        source: 'manual',
        error_name: 'Error',
        message: 'chunk failed',
        chunk: '5314',
        authToken: '[redacted]',
      }),
    );
  });

  it('captures auth and signup failures without secret values', () => {
    initPostHog({ apiKey: 'phc_test' });

    captureAuthFailure({
      projectSlug: 'reader',
      stage: 'signin',
      provider: 'google',
      statusCode: 404,
      reason: 'PROVIDER_NOT_FOUND',
      extra: {
        credential: 'raw-google-credential',
        nested: { cookie: 'session=secret', safe: 'kept' },
      },
    });
    captureSignupFailure({
      projectSlug: 'swe-interview-prep',
      provider: 'google',
      statusCode: 500,
      reason: 'Authentication is not configured',
    });

    expect(captureMock).toHaveBeenNthCalledWith(
      1,
      'foundry_auth_failure',
      expect.objectContaining({
        project_slug: 'reader',
        stage: 'signin',
        provider: 'google',
        credential: '[redacted]',
        nested: { cookie: '[redacted]', safe: 'kept' },
      }),
    );
    expect(captureMock).toHaveBeenNthCalledWith(
      2,
      'foundry_signup_failure',
      expect.objectContaining({
        project_slug: 'swe-interview-prep',
        provider: 'google',
        status_code: 500,
      }),
    );
    expect(captureMock).toHaveBeenNthCalledWith(
      3,
      'foundry_auth_failure',
      expect.objectContaining({
        project_slug: 'swe-interview-prep',
        stage: 'signup',
      }),
    );
  });

  it('installs browser error listeners and returns a teardown', () => {
    initPostHog({ apiKey: 'phc_test' });
    const teardown = installBrowserMonitoring({
      projectSlug: 'starboard',
      environment: 'production',
    });

    window.dispatchEvent(new ErrorEvent('error', { error: new Error('__name is not defined') }));
    expect(captureMock).toHaveBeenCalledWith(
      'foundry_page_crash',
      expect.objectContaining({
        project_slug: 'starboard',
        source: 'window_error',
        message: '__name is not defined',
      }),
    );

    teardown();
    captureMock.mockReset();
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('after teardown') }));
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('redacts sensitive keys recursively', () => {
    expect(
      sanitizeMonitoringProperties({
        authorization: 'Bearer token',
        meta: {
          apiKey: 'secret',
          route: '/signin',
        },
      }),
    ).toEqual({
      authorization: '[redacted]',
      meta: {
        apiKey: '[redacted]',
        route: '/signin',
      },
    });
  });
});
