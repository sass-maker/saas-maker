/**
 * Server-side PostHog ingest helpers for CF Workers / Node runtimes.
 *
 * Browser code should use `initOpsMonitoring` (posthog-js) from `./posthog.ts`.
 * Server code (CF Worker, Node) calls these — no SDK, just /capture/ HTTPS.
 */

interface CaptureEvent {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}

let _apiKey: string | null = null;
let _host = 'https://us.i.posthog.com';
const queue: Promise<unknown>[] = [];

export function configurePostHog(apiKey: string, host = 'https://us.i.posthog.com'): void {
  _apiKey = apiKey;
  _host = host.replace(/\/+$/, '');
}

export function capture(event: CaptureEvent): void {
  if (!_apiKey) return;
  const body = {
    api_key: _apiKey,
    distinct_id: event.distinctId,
    event: event.event,
    properties: event.properties ?? {},
    timestamp: new Date().toISOString(),
  };
  const promise = fetch(`${_host}/i/v0/e/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch((err) => {
    console.error('[ops] PostHog capture failed:', err instanceof Error ? err.message : err);
  });
  queue.push(promise);
}

interface IdentifyEvent {
  distinctId: string;
  properties?: Record<string, unknown>;
}

export function identify(event: IdentifyEvent): void {
  capture({
    distinctId: event.distinctId,
    event: '$identify',
    properties: { $set: event.properties ?? {} },
  });
}

export async function flushPostHog(): Promise<void> {
  const pending = queue.splice(0, queue.length);
  await Promise.allSettled(pending);
}
