/**
 * Browser PostHog client. Lazy-initialized; safe to import in SSR.
 * Reads NEXT_PUBLIC_POSTHOG_KEY / NEXT_PUBLIC_POSTHOG_HOST when no apiKey passed.
 */

import posthogJs, { type PostHog } from 'posthog-js';
import type { BaseEventMap, EventName, EventProps, PostHogClientConfig } from './types.js';

let _client: PostHog | null = null;
let _initialized = false;

declare const process: { env?: Record<string, string | undefined> } | undefined;

function readEnv(): { apiKey?: string; host?: string } {
  if (typeof process === 'undefined') return {};
  const env = (process.env ?? {}) as Record<string, string | undefined>;
  return {
    apiKey: env['NEXT_PUBLIC_POSTHOG_KEY'] ?? env['POSTHOG_KEY'],
    host: env['NEXT_PUBLIC_POSTHOG_HOST'] ?? env['POSTHOG_HOST'],
  };
}

export function initPostHog(config: Partial<PostHogClientConfig> = {}): PostHog | null {
  if (typeof window === 'undefined') return null;
  if (_initialized && _client) return _client;

  const env = readEnv();
  const apiKey = config.apiKey ?? env.apiKey;
  if (!apiKey || config.disabled) return null;

  posthogJs.init(apiKey, {
    api_host: config.host ?? env.host ?? 'https://us.i.posthog.com',
    autocapture: config.autocapture ?? false,
    capture_pageview: 'history_change',
  });

  if (config.superProperties) {
    posthogJs.register(config.superProperties);
  }

  _client = posthogJs;
  _initialized = true;
  return _client;
}

export function getPostHog(): PostHog | null {
  return _client;
}

export function track<E extends BaseEventMap = BaseEventMap, K extends EventName<E> = EventName<E>>(
  event: K,
  properties?: EventProps<E, K>,
): void {
  if (!_client) return;
  _client.capture(event as string, properties as Record<string, unknown> | undefined);
}

export function identify(distinctId: string, properties?: Record<string, unknown>): void {
  if (!_client) return;
  _client.identify(distinctId, properties);
}

export function reset(): void {
  if (!_client) return;
  _client.reset();
}

/**
 * Test-only — clears module state. Do not call from app code.
 */
export function __resetForTests(): void {
  _client = null;
  _initialized = false;
}
