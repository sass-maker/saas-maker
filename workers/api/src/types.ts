import { Context } from 'hono';

export type Bindings = {
  AUTH_SECRET: string;
  APP_BASE_URL: string;
  CORS_ORIGIN: string;
  DB: D1Database;
  FEEDBACK_IMAGES: R2Bucket;
  RESEND_API_KEY: string;
  NOTIFICATION_FROM_EMAIL: string;
  FREE_AI_BASE_URL: string;
  FREE_AI_API_KEY: string;
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> };
  POSTHOG_API_KEY?: string;
  /** Set in prod to enable POST /v1/test/mint-session for e2e session minting. Unset = endpoint returns 404. */
  FOUNDRY_E2E_SECRET?: string;
};

export type Variables = {
  requestId: string;
  userId?: string;
  projectId?: string;
  project?: any;
};

export type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;
