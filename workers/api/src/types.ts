import { Context } from 'hono';

export type Bindings = {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_OAUTH_REDIRECT_URI: string;
  SESSION_SECRET: string;
  APP_BASE_URL: string;
  CORS_ORIGIN: string;
  DATABASE_URL: string;
  FEEDBACK_IMAGES: R2Bucket;
  RESEND_API_KEY: string;
  NOTIFICATION_FROM_EMAIL: string;
};

export type Variables = {
  requestId: string;
  userId?: string;
  projectId?: string;
};

export type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;
