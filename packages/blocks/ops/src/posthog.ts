// Fire-and-forget telemetry — NEVER throws, NEVER blocks the hot path
export interface TraceEvent {
  operation: string;
  durationMs: number;
  outcome: 'ok' | 'error';
  project?: string;
  errorCode?: string;
  [key: string]: unknown;
}

let _posthogKey: string | undefined;
let _posthogHost = 'https://eu.i.posthog.com';

export function configurePostHog(apiKey: string, host?: string) {
  _posthogKey = apiKey;
  if (host) _posthogHost = host;
}

export function shipTrace(event: TraceEvent): void {
  if (!_posthogKey) return;
  const key = _posthogKey;
  const host = _posthogHost;

  // Fire and forget — wrapped in a try so it never throws
  Promise.resolve().then(() =>
    fetch(`${host}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        event: 'foundry_trace',
        distinct_id: event.project ?? 'anonymous',
        properties: event,
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {}) // swallow all errors
  ).catch(() => {});
}
