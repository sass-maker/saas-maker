import { createWorkerHealthBuffer } from './app-health-buffer';
import { honoMiddleware } from '@saas-maker/app-health/hono';
import type { Bindings, Variables } from '../types';

const bufferedClient = createWorkerHealthBuffer();
const INGEST_ENDPOINT = 'https://ingest.sassmaker.com/v1/ingest';

export const appHealthEndpoints = honoMiddleware<{ Bindings: Bindings; Variables: Variables }>({
  client: (context) => {
    const key = context.env.APP_HEALTH_INGEST_KEY;
    if (!key) return null;

    return bufferedClient(context.env, {
      key,
      environment: context.env.APP_HEALTH_ENVIRONMENT || 'production',
      endpoint: INGEST_ENDPOINT,
      runtime: 'worker',
      maxBatchSize: 100,
      maxQueueSize: 100,
      maxRetries: 0,
      requestTimeoutMs: 1000,
      disableTimer: true,
    });
  },
});
