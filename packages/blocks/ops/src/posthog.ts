// Fire-and-forget telemetry — NEVER throws, NEVER blocks the hot path
export interface TraceEvent {
  operation: string;
  durationMs: number;
  outcome: 'ok' | 'error';
  project?: string;
  errorCode?: string;
  [key: string]: unknown;
}

export interface CaptureEvent {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}

export interface IdentifyPayload {
  distinctId: string;
  properties: Record<string, unknown>;
}

let _posthogKey: string | undefined;
let _posthogHost = 'https://us.i.posthog.com';
// Pending fetch promises — register with ctx.waitUntil() in CF Workers
const _pending: Promise<unknown>[] = [];

export function configurePostHog(apiKey: string, host?: string) {
  _posthogKey = apiKey;
  if (host) _posthogHost = host;
}

/**
 * In Cloudflare Workers, call ctx.waitUntil(flushPostHog()) after awaiting next()
 * so pending PostHog requests are not killed when the response is sent.
 */
export function flushPostHog(): Promise<unknown[]> {
  const batch = _pending.splice(0);
  return Promise.all(batch);
}

function _send(body: Record<string, unknown>): void {
  if (!_posthogKey) return;
  const p = fetch(`${_posthogHost}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: _posthogKey, ...body }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => {});
  _pending.push(p);
}

export function capture(event: CaptureEvent): void {
  if (!_posthogKey) return;
  _send({
    event: event.event,
    distinct_id: event.distinctId,
    properties: event.properties ?? {},
    timestamp: new Date().toISOString(),
  });
}

export function identify(payload: IdentifyPayload): void {
  if (!_posthogKey) return;
  _send({
    event: '$identify',
    distinct_id: payload.distinctId,
    properties: { $set: payload.properties },
    timestamp: new Date().toISOString(),
  });
}

export function shipTrace(event: TraceEvent): void {
  if (!_posthogKey) return;
  _send({
    event: 'foundry_trace',
    distinct_id: event.project ?? 'anonymous',
    properties: event,
    timestamp: new Date().toISOString(),
  });
}
