import { Context } from 'hono';

export type Bindings = {
  AUTH_SECRET: string;
  APP_BASE_URL: string;
  CORS_ORIGIN: string;
  DATABASE_URL: string;
  HYPERDRIVE: Hyperdrive;
  FEEDBACK_IMAGES: R2Bucket;
  RESEND_API_KEY: string;
  NOTIFICATION_FROM_EMAIL: string;
  FREE_AI_BASE_URL: string;
  FREE_AI_API_KEY: string;
};

export type Variables = {
  requestId: string;
  userId?: string;
  projectId?: string;
};

export type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;
