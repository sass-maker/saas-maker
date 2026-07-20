/**
 * Optional canary timing for the SaaS Maker API itself.
 * Enabled only when PERFORMANCE_CANARY_INGEST_URL and PERFORMANCE_CANARY_API_KEY are set.
 * Delivery is always asynchronous and never fails the product request.
 */

import {
  createRuntimeAdapter,
  normalizeRouteTemplate,
} from '../../../../internal/performance-runtime/index';

function getAdapter(env: {
  PERFORMANCE_CANARY_INGEST_URL?: string;
  PERFORMANCE_CANARY_API_KEY?: string;
  PERFORMANCE_CANARY_PROJECT_ID?: string;
}): ReturnType<typeof createRuntimeAdapter> | null {
  const base = env.PERFORMANCE_CANARY_INGEST_URL;
  const key = env.PERFORMANCE_CANARY_API_KEY;
  if (!base || !key) return null;
  return createRuntimeAdapter({
    projectId: env.PERFORMANCE_CANARY_PROJECT_ID || 'sass-maker',
    surface: 'sass-maker-api',
    environment: 'production',
    ingestBaseUrl: base,
    apiKey: key,
    successSampleRate: 0.1,
  });
}

export function maybeRecordCanarySpan(
  env: {
    PERFORMANCE_CANARY_INGEST_URL?: string;
    PERFORMANCE_CANARY_API_KEY?: string;
    PERFORMANCE_CANARY_PROJECT_ID?: string;
  },
  input: {
    method: string;
    path: string;
    status: number;
    durationMs: number;
  }
): Promise<void> | null {
  const a = getAdapter(env);
  if (!a) return null;
  // Never instrument the performance ingest endpoints (feedback loop).
  if (input.path.startsWith('/v1/performance')) return null;
  if (input.path === '/health') return null;
  return a.recordRequest({
    method: input.method,
    routeTemplate: normalizeRouteTemplate(input.path),
    status: input.status,
    durationMs: input.durationMs,
  });
}
