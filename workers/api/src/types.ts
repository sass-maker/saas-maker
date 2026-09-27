import { Context } from 'hono';

export type Bindings = {
  APP_BASE_URL: string;
  CORS_ORIGIN: string;
  DB: D1Database;
  FEEDBACK_IMAGES: R2Bucket;
  RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> };
  APP_HEALTH_INGEST_KEY?: string;
  APP_HEALTH_ENVIRONMENT?: string;
  CAPTURE_SIGNING_KEY?: string;
  LOCAL_AUTH_BYPASS?: string;
  SAASMAKER_LOCAL_SESSION_TOKEN?: string;
};

export type Variables = {
  requestId: string;
  userId?: string;
  projectId?: string;
  project?: any;
  actorKind?: 'owner' | 'agent';
  canWrite?: boolean;
  agentTokenId?: string;
};

export type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;
