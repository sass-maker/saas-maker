/**
 * Server-side PostHog client wrapping `posthog-node`.
 * Use in Next.js route handlers, server actions, CF Workers (with nodejs_compat),
 * or any Node runtime.
 */

import { PostHog } from 'posthog-node';
import type { BaseEventMap, EventName, EventProps } from './types.js';

export interface ServerConfig {
  apiKey: string;
  host?: string;
  flushAt?: number;
  flushInterval?: number;
}

let _server: PostHog | null = null;

export function createPostHogServer(config: ServerConfig): PostHog {
  const client = new PostHog(config.apiKey, {
    host: config.host ?? 'https://us.i.posthog.com',
    flushAt: config.flushAt ?? 1,
    flushInterval: config.flushInterval ?? 0,
  });
  _server = client;
  return client;
}

export function getServerClient(): PostHog | null {
  return _server;
}

export interface ServerTrackArgs<P> {
  distinctId: string;
  properties?: P;
  groups?: Record<string, string>;
}

export function trackServer<
  E extends BaseEventMap = BaseEventMap,
  K extends EventName<E> = EventName<E>,
>(event: K, args: ServerTrackArgs<EventProps<E, K>>): void {
  if (!_server) return;
  _server.capture({
    distinctId: args.distinctId,
    event: event as string,
    properties: args.properties as Record<string, unknown> | undefined,
    groups: args.groups,
  });
}

export function identifyServer(
  distinctId: string,
  properties: Record<string, unknown>,
): void {
  if (!_server) return;
  _server.identify({ distinctId, properties });
}

export async function flushServer(): Promise<void> {
  if (!_server) return;
  await _server.flush();
}

export async function shutdownServer(): Promise<void> {
  if (!_server) return;
  await _server.shutdown();
  _server = null;
}
