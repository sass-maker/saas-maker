# Feedback Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an embeddable feedback collection system — React widget SDK + Cloudflare Workers API + Next.js dashboard — as the first saas-maker module.

**Architecture:** pnpm monorepo with 3 layers: `packages/` (shared-types, db, feedback-widget), `workers/api` (Hono on Cloudflare Workers), `apps/dashboard` (Next.js 15). Widget submits feedback via API key auth, dashboard uses Google OAuth via Auth.js. Images stored in Cloudflare R2, notifications via Resend.

**Tech Stack:** Next.js 15, Hono, Cloudflare Workers + R2, CockroachDB, Auth.js v5, shadcn/ui + Tailwind, Resend, pnpm workspaces, vitest

**Design doc:** `docs/plans/2026-02-26-feedback-module-design.md`

---

### Task 1: Scaffold Monorepo

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.nvmrc`

**Step 1: Initialize pnpm workspace**

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker
pnpm init
```

Edit `package.json`:
```json
{
  "name": "saas-maker",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev:api": "pnpm -F @saasmaker/api dev",
    "dev:dashboard": "pnpm -F @saasmaker/dashboard dev",
    "build:types": "pnpm -F @saasmaker/shared-types build",
    "build:db": "pnpm -F @saasmaker/db build",
    "build:api": "pnpm -F @saasmaker/api build",
    "build:dashboard": "pnpm -F @saasmaker/dashboard build",
    "build:widget": "pnpm -F @saasmaker/feedback build",
    "test": "vitest run"
  }
}
```

**Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "workers/*"
```

**Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
.next/
.wrangler/
.env
.env.local
*.tsbuildinfo
```

**Step 5: Create .nvmrc**

```
22
```

**Step 6: Commit**

```bash
git add -A && git commit -m "scaffold: pnpm monorepo with workspace config"
```

---

### Task 2: Shared Types Package

**Files:**
- Create: `packages/shared-types/package.json`
- Create: `packages/shared-types/tsconfig.json`
- Create: `packages/shared-types/src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@saasmaker/shared-types",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc"
  },
  "devDependencies": {
    "typescript": "^5.9.3"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 3: Write types in src/index.ts**

```typescript
// --- Enums / Unions ---

export type FeedbackType = 'bug' | 'feature' | 'feedback';
export type FeedbackStatus = 'new' | 'in_progress' | 'done' | 'dismissed';

// --- Records (DB row shapes) ---

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  slug: string;
  api_key: string;
  owner_id: string;
  created_at: string;
}

export interface FeedbackRecord {
  id: string;
  project_id: string;
  type: FeedbackType;
  status: FeedbackStatus;
  title: string;
  description: string;
  image_url: string | null;
  submitter_email: string;
  submitter_name: string | null;
  upvote_count: number;
  created_at: string;
}

export interface UpvoteRecord {
  id: string;
  feedback_id: string;
  user_id: string;
  created_at: string;
}

// --- API Request / Response ---

export interface CreateProjectRequest {
  name: string;
}

export interface SubmitFeedbackRequest {
  type: FeedbackType;
  title: string;
  description: string;
  image_url?: string;
  submitter_email: string;
  submitter_name?: string;
}

export interface UpdateFeedbackStatusRequest {
  status: FeedbackStatus;
}

export interface FeedbackListQuery {
  type?: FeedbackType;
  status?: FeedbackStatus;
  sort?: 'newest' | 'upvotes';
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// --- Widget Props ---

export interface FeedbackWidgetProps {
  projectId: string;
  apiBaseUrl?: string;
  userEmail?: string;
  userName?: string;
  types?: FeedbackType[];
  position?: 'bottom-right' | 'bottom-left';
  theme?: 'light' | 'dark' | 'auto';
  accentColor?: string;
  triggerText?: string;
}
```

**Step 4: Build and verify**

```bash
pnpm install && pnpm build:types
```
Expected: `packages/shared-types/dist/` created with `.js` and `.d.ts` files.

**Step 5: Commit**

```bash
git add packages/shared-types && git commit -m "feat: add shared-types package with core type definitions"
```

---

### Task 3: Database Package

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/migrations/0001_init.sql`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/src/schema.ts`

**Step 1: Create package.json**

```json
{
  "name": "@saasmaker/db",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "@saasmaker/shared-types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.9.3"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 3: Write migration 0001_init.sql**

```sql
-- Feedback module initial schema (CockroachDB/Postgres compatible)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  api_key TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'feedback')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'done', 'dismissed')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  submitter_email TEXT NOT NULL,
  submitter_name TEXT,
  upvote_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS upvotes (
  id TEXT PRIMARY KEY,
  feedback_id TEXT NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (feedback_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_project ON feedback(project_id);
CREATE INDEX IF NOT EXISTS idx_feedback_project_status ON feedback(project_id, status);
CREATE INDEX IF NOT EXISTS idx_feedback_project_upvotes ON feedback(project_id, upvote_count DESC);
CREATE INDEX IF NOT EXISTS idx_upvotes_feedback ON upvotes(feedback_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
```

**Step 4: Write schema.ts (table name constants)**

```typescript
export const TABLES = {
  users: 'users',
  projects: 'projects',
  feedback: 'feedback',
  upvotes: 'upvotes',
} as const;
```

**Step 5: Write src/index.ts (DB interface + query helpers)**

This defines the database interface. Actual implementation (CockroachDB client) will be wired in the worker. For now, export the interface and types:

```typescript
import {
  FeedbackRecord,
  FeedbackListQuery,
  ProjectRecord,
  UserRecord,
  UpvoteRecord,
} from '@saasmaker/shared-types';

export { TABLES } from './schema';

export interface FeedbackDatabase {
  // Users
  upsertUser(input: { id: string; email: string; name: string | null; avatar_url: string | null }): Promise<UserRecord>;
  getUserById(id: string): Promise<UserRecord | null>;

  // Projects
  createProject(input: { id: string; name: string; slug: string; api_key: string; owner_id: string }): Promise<ProjectRecord>;
  getProjectBySlug(slug: string): Promise<ProjectRecord | null>;
  getProjectByApiKey(apiKey: string): Promise<ProjectRecord | null>;
  getProjectById(id: string): Promise<ProjectRecord | null>;
  listProjectsByOwner(ownerId: string): Promise<ProjectRecord[]>;
  updateProject(id: string, input: Partial<Pick<ProjectRecord, 'name'>>): Promise<ProjectRecord | null>;
  deleteProject(id: string): Promise<boolean>;

  // Feedback
  createFeedback(input: {
    id: string; project_id: string; type: string; title: string;
    description: string; image_url: string | null;
    submitter_email: string; submitter_name: string | null;
  }): Promise<FeedbackRecord>;
  getFeedbackById(id: string): Promise<FeedbackRecord | null>;
  listFeedback(projectId: string, query: FeedbackListQuery): Promise<{ data: FeedbackRecord[]; total: number }>;
  updateFeedbackStatus(id: string, status: string): Promise<FeedbackRecord | null>;
  deleteFeedback(id: string): Promise<boolean>;

  // Upvotes
  addUpvote(input: { id: string; feedback_id: string; user_id: string }): Promise<UpvoteRecord>;
  removeUpvote(feedbackId: string, userId: string): Promise<boolean>;
  hasUpvoted(feedbackId: string, userId: string): Promise<boolean>;
}
```

**Step 6: Build and verify**

```bash
pnpm install && pnpm build:db
```

**Step 7: Commit**

```bash
git add packages/db && git commit -m "feat: add db package with schema migration and interface"
```

---

### Task 4: Workers API — Scaffold + Health Check

**Files:**
- Create: `workers/api/package.json`
- Create: `workers/api/tsconfig.json`
- Create: `workers/api/wrangler.toml`
- Create: `workers/api/src/index.ts`
- Create: `workers/api/src/types.ts`

**Step 1: Create package.json**

```json
{
  "name": "@saasmaker/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "build": "wrangler deploy --dry-run",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "@saasmaker/shared-types": "workspace:*",
    "@saasmaker/db": "workspace:*",
    "hono": "^4.7.2"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250224.0",
    "wrangler": "^4.0.0",
    "typescript": "^5.9.3"
  }
}
```

**Step 2: Create wrangler.toml**

```toml
name = "saasmaker-api"
main = "src/index.ts"
compatibility_date = "2026-02-22"
compatibility_flags = ["nodejs_compat"]

[observability]
enabled = true

[[r2_buckets]]
binding = "FEEDBACK_IMAGES"
bucket_name = "saasmaker-feedback-images"
```

**Step 3: Create src/types.ts**

```typescript
import { Context } from 'hono';

export type Bindings = {
  // Auth
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_OAUTH_REDIRECT_URI: string;
  SESSION_SECRET: string;
  // App
  APP_BASE_URL: string;
  CORS_ORIGIN: string;
  // DB
  DATABASE_URL: string;
  // R2
  FEEDBACK_IMAGES: R2Bucket;
  // Email
  RESEND_API_KEY: string;
  NOTIFICATION_FROM_EMAIL: string;
};

export type Variables = {
  requestId: string;
  userId?: string;
  projectId?: string;
};

export type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;
```

**Step 4: Create src/index.ts (Hono app with health check + CORS)**

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bindings, Variables } from './types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// CORS
app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.CORS_ORIGIN || '*',
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Project-Key', 'Authorization'],
    credentials: true,
  });
  return corsMiddleware(c, next);
});

// Request ID
app.use('*', async (c, next) => {
  c.set('requestId', crypto.randomUUID());
  await next();
});

// Health
app.get('/health', (c) => c.json({ status: 'ok' }));

export default app;
```

**Step 5: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src"]
}
```

**Step 6: Install deps and verify**

```bash
pnpm install && cd workers/api && pnpm dev
```

Expected: Worker starts, `curl localhost:8787/health` returns `{"status":"ok"}`

**Step 7: Commit**

```bash
git add workers/api && git commit -m "feat: scaffold workers API with Hono, CORS, and health check"
```

---

### Task 5: Workers API — Google OAuth Auth Routes

**Files:**
- Create: `workers/api/src/routes/auth.ts`
- Modify: `workers/api/src/index.ts` (mount auth routes)
- Modify: `workers/api/package.json` (add arctic dependency)

**Step 1: Add arctic dependency**

Arctic is a lightweight OAuth library that works on edge runtimes (CF Workers). Auth.js is for the Next.js dashboard; the Workers API handles its own OAuth flow for the widget upvote auth.

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker && pnpm -F @saasmaker/api add arctic
```

**Step 2: Write auth routes**

`workers/api/src/routes/auth.ts`:

```typescript
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { Google } from 'arctic';
import { Bindings, Variables } from '../types';

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function getGoogleClient(c: { env: Bindings }) {
  return new Google(
    c.env.GOOGLE_CLIENT_ID,
    c.env.GOOGLE_CLIENT_SECRET,
    c.env.GOOGLE_OAUTH_REDIRECT_URI,
  );
}

// Initiate Google OAuth
auth.get('/google', async (c) => {
  const google = getGoogleClient(c);
  const state = crypto.randomUUID();
  const codeVerifier = crypto.randomUUID();
  const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'email', 'profile']);

  setCookie(c, 'oauth_state', state, { httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 600, path: '/' });
  setCookie(c, 'oauth_verifier', codeVerifier, { httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 600, path: '/' });

  return c.redirect(url.toString());
});

// Google OAuth callback
auth.get('/google/callback', async (c) => {
  const google = getGoogleClient(c);
  const { code, state } = c.req.query();
  const storedState = getCookie(c, 'oauth_state');
  const storedVerifier = getCookie(c, 'oauth_verifier');

  if (!code || !state || state !== storedState || !storedVerifier) {
    return c.json({ error: 'Invalid OAuth state' }, 400);
  }

  deleteCookie(c, 'oauth_state');
  deleteCookie(c, 'oauth_verifier');

  const tokens = await google.validateAuthorizationCode(code, storedVerifier);
  const accessToken = tokens.accessToken();

  // Fetch Google user info
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const googleUser = await userRes.json() as { id: string; email: string; name: string; picture: string };

  // TODO: Upsert user in DB, create session token
  // For now, set a session cookie with user info
  const sessionToken = crypto.randomUUID();

  // Placeholder: store session (will be replaced with DB session in Task 8)
  setCookie(c, 'sm_session', sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });

  return c.redirect(c.env.APP_BASE_URL + '/projects');
});

// Get current session
auth.get('/session', async (c) => {
  const session = getCookie(c, 'sm_session');
  if (!session) {
    return c.json({ authenticated: false }, 401);
  }
  // TODO: Look up session in DB, return user
  return c.json({ authenticated: true });
});

// Logout
auth.post('/logout', async (c) => {
  deleteCookie(c, 'sm_session');
  return c.json({ ok: true });
});

export { auth };
```

**Step 3: Mount auth routes in index.ts**

Add to `workers/api/src/index.ts`:
```typescript
import { auth } from './routes/auth';
app.route('/v1/auth', auth);
```

**Step 4: Verify locally**

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker/workers/api && pnpm dev
```

`curl localhost:8787/v1/auth/session` should return `{"authenticated":false}` with 401.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add Google OAuth routes with arctic"
```

---

### Task 6: Workers API — Project CRUD Routes

**Files:**
- Create: `workers/api/src/routes/projects.ts`
- Create: `workers/api/src/middleware/auth.ts`
- Modify: `workers/api/src/index.ts` (mount project routes)

**Step 1: Write auth middleware**

`workers/api/src/middleware/auth.ts`:

```typescript
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { Bindings, Variables } from '../types';

// Requires authenticated session (dashboard)
export const requireSession = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const session = getCookie(c, 'sm_session');
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    // TODO: Look up session in DB, set userId
    // c.set('userId', user.id);
    await next();
  }
);

// Requires API key (widget SDK)
export const requireApiKey = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const apiKey = c.req.header('X-Project-Key');
    if (!apiKey) {
      return c.json({ error: 'Missing X-Project-Key header' }, 401);
    }
    // TODO: Look up project by API key in DB, set projectId
    // c.set('projectId', project.id);
    await next();
  }
);
```

**Step 2: Write project routes**

`workers/api/src/routes/projects.ts`:

```typescript
import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireSession } from '../middleware/auth';

const projects = new Hono<{ Bindings: Bindings; Variables: Variables }>();

projects.use('*', requireSession);

function generateApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const key = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `pk_${key}`;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// List projects for current user
projects.get('/', async (c) => {
  const userId = c.get('userId');
  // TODO: db.listProjectsByOwner(userId)
  return c.json({ data: [] });
});

// Create project
projects.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json() as { name: string };

  if (!body.name || body.name.trim().length === 0) {
    return c.json({ error: 'Project name is required' }, 400);
  }

  const project = {
    id: crypto.randomUUID(),
    name: body.name.trim(),
    slug: slugify(body.name) + '-' + Date.now().toString(36),
    api_key: generateApiKey(),
    owner_id: userId,
    created_at: new Date().toISOString(),
  };

  // TODO: db.createProject(project)
  return c.json(project, 201);
});

// Update project
projects.patch('/:id', async (c) => {
  const projectId = c.req.param('id');
  const body = await c.req.json() as { name?: string };
  // TODO: verify ownership, db.updateProject(projectId, body)
  return c.json({ id: projectId, ...body });
});

// Delete project
projects.delete('/:id', async (c) => {
  const projectId = c.req.param('id');
  // TODO: verify ownership, db.deleteProject(projectId)
  return c.json({ ok: true });
});

export { projects };
```

**Step 3: Mount in index.ts**

```typescript
import { projects } from './routes/projects';
app.route('/v1/projects', projects);
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add project CRUD routes with auth middleware"
```

---

### Task 7: Workers API — Feedback Routes

**Files:**
- Create: `workers/api/src/routes/feedback.ts`
- Modify: `workers/api/src/index.ts` (mount)

**Step 1: Write feedback routes**

`workers/api/src/routes/feedback.ts`:

```typescript
import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey, requireSession } from '../middleware/auth';
import { SubmitFeedbackRequest, FeedbackType, FeedbackStatus } from '@saasmaker/shared-types';

const feedback = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const VALID_TYPES: FeedbackType[] = ['bug', 'feature', 'feedback'];
const VALID_STATUSES: FeedbackStatus[] = ['new', 'in_progress', 'done', 'dismissed'];
const VALID_SORTS = ['newest', 'upvotes'] as const;
const PAGE_SIZE = 20;

// --- Public (API key auth) ---

// Submit feedback
feedback.post('/', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const body = await c.req.json() as SubmitFeedbackRequest;

  if (!body.title?.trim()) return c.json({ error: 'Title is required' }, 400);
  if (!body.description?.trim()) return c.json({ error: 'Description is required' }, 400);
  if (!body.submitter_email?.trim()) return c.json({ error: 'Email is required' }, 400);
  if (!VALID_TYPES.includes(body.type)) return c.json({ error: 'Invalid type' }, 400);

  const record = {
    id: crypto.randomUUID(),
    project_id: projectId,
    type: body.type,
    status: 'new' as const,
    title: body.title.trim(),
    description: body.description.trim(),
    image_url: body.image_url || null,
    submitter_email: body.submitter_email.trim(),
    submitter_name: body.submitter_name?.trim() || null,
    upvote_count: 0,
    created_at: new Date().toISOString(),
  };

  // TODO: db.createFeedback(record)
  // TODO: Send email notification to project owner

  return c.json(record, 201);
});

// List feedback for a project (widget browse tab)
feedback.get('/', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const type = c.req.query('type') as FeedbackType | undefined;
  const status = c.req.query('status') as FeedbackStatus | undefined;
  const sort = c.req.query('sort') || 'newest';
  const page = parseInt(c.req.query('page') || '1', 10);

  if (type && !VALID_TYPES.includes(type)) return c.json({ error: 'Invalid type filter' }, 400);
  if (status && !VALID_STATUSES.includes(status)) return c.json({ error: 'Invalid status filter' }, 400);

  // TODO: db.listFeedback(projectId, { type, status, sort, page, limit: PAGE_SIZE })
  return c.json({ data: [], total: 0, page, limit: PAGE_SIZE });
});

// Upvote (requires authenticated user)
feedback.post('/:id/upvote', requireSession, async (c) => {
  const feedbackId = c.req.param('id');
  const userId = c.get('userId')!;

  // TODO: db.hasUpvoted(feedbackId, userId) → if already, return 409
  // TODO: db.addUpvote({ id: crypto.randomUUID(), feedback_id: feedbackId, user_id: userId })
  // TODO: increment feedback.upvote_count

  return c.json({ ok: true }, 201);
});

// Remove upvote
feedback.delete('/:id/upvote', requireSession, async (c) => {
  const feedbackId = c.req.param('id');
  const userId = c.get('userId')!;

  // TODO: db.removeUpvote(feedbackId, userId)
  // TODO: decrement feedback.upvote_count

  return c.json({ ok: true });
});

// --- Dashboard (session auth) ---

// Get feedback for a project (dashboard inbox)
feedback.get('/inbox/:projectId', requireSession, async (c) => {
  const projectId = c.req.param('projectId');
  const type = c.req.query('type') as FeedbackType | undefined;
  const status = c.req.query('status') as FeedbackStatus | undefined;
  const sort = c.req.query('sort') || 'newest';
  const page = parseInt(c.req.query('page') || '1', 10);

  // TODO: verify ownership
  // TODO: db.listFeedback(projectId, { type, status, sort, page, limit: PAGE_SIZE })
  return c.json({ data: [], total: 0, page, limit: PAGE_SIZE });
});

// Update feedback status
feedback.patch('/:id', requireSession, async (c) => {
  const feedbackId = c.req.param('id');
  const body = await c.req.json() as { status: FeedbackStatus };

  if (!VALID_STATUSES.includes(body.status)) return c.json({ error: 'Invalid status' }, 400);

  // TODO: verify ownership through project
  // TODO: db.updateFeedbackStatus(feedbackId, body.status)
  return c.json({ id: feedbackId, status: body.status });
});

// Delete feedback
feedback.delete('/:id', requireSession, async (c) => {
  const feedbackId = c.req.param('id');
  // TODO: verify ownership
  // TODO: db.deleteFeedback(feedbackId)
  return c.json({ ok: true });
});

export { feedback };
```

**Step 2: Mount in index.ts**

```typescript
import { feedback } from './routes/feedback';
app.route('/v1/feedback', feedback);
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add feedback CRUD + upvote routes"
```

---

### Task 8: Workers API — R2 Image Upload

**Files:**
- Create: `workers/api/src/routes/upload.ts`
- Modify: `workers/api/src/index.ts` (mount)

**Step 1: Write upload route**

`workers/api/src/routes/upload.ts`:

```typescript
import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey } from '../middleware/auth';

const upload = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

upload.post('/', requireApiKey, async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;

  if (!file) return c.json({ error: 'No file provided' }, 400);
  if (!ALLOWED_TYPES.includes(file.type)) return c.json({ error: 'Invalid file type. Allowed: jpeg, png, gif, webp' }, 400);
  if (file.size > MAX_FILE_SIZE) return c.json({ error: 'File too large. Max 5MB' }, 400);

  const ext = file.type.split('/')[1];
  const key = `feedback/${crypto.randomUUID()}.${ext}`;

  await c.env.FEEDBACK_IMAGES.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  // R2 public URL depends on your custom domain or R2 public access config
  // For now return the key; the dashboard/widget will construct the full URL
  const imageUrl = `https://images.saasmaker.dev/${key}`;

  return c.json({ url: imageUrl }, 201);
});

export { upload };
```

**Step 2: Mount in index.ts**

```typescript
import { upload } from './routes/upload';
app.route('/v1/upload', upload);
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add image upload route with R2 storage"
```

---

### Task 9: Workers API — Email Notifications via Resend

**Files:**
- Create: `workers/api/src/email.ts`

**Step 1: Write email helper**

`workers/api/src/email.ts`:

```typescript
interface SendEmailParams {
  to: string;
  projectName: string;
  feedbackTitle: string;
  feedbackType: string;
  feedbackDescription: string;
  submitterEmail: string;
  dashboardUrl: string;
}

export async function sendNewFeedbackEmail(
  resendApiKey: string,
  fromEmail: string,
  params: SendEmailParams
): Promise<void> {
  const { to, projectName, feedbackTitle, feedbackType, feedbackDescription, submitterEmail, dashboardUrl } = params;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject: `[${projectName}] New ${feedbackType}: ${feedbackTitle}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2>New ${feedbackType} on ${projectName}</h2>
          <p><strong>${feedbackTitle}</strong></p>
          <p>${feedbackDescription}</p>
          <p style="color: #666;">From: ${submitterEmail}</p>
          <a href="${dashboardUrl}" style="display: inline-block; padding: 10px 20px; background: #1464ff; color: #fff; text-decoration: none; border-radius: 8px; margin-top: 12px;">
            View in Dashboard
          </a>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    console.error('Resend email failed:', await response.text());
  }
}
```

**Step 2: Wire into feedback submission route**

In `workers/api/src/routes/feedback.ts`, after `db.createFeedback(record)`:

```typescript
import { sendNewFeedbackEmail } from '../email';

// After creating feedback (inside POST / handler):
// const project = await db.getProjectById(projectId);
// const owner = await db.getUserById(project.owner_id);
// await sendNewFeedbackEmail(c.env.RESEND_API_KEY, c.env.NOTIFICATION_FROM_EMAIL, {
//   to: owner.email,
//   projectName: project.name,
//   feedbackTitle: record.title,
//   feedbackType: record.type,
//   feedbackDescription: record.description,
//   submitterEmail: record.submitter_email,
//   dashboardUrl: `${c.env.APP_BASE_URL}/projects/${project.slug}`,
// });
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add email notification helper via Resend"
```

---

### Task 10: Workers API — Wire Up CockroachDB

**Files:**
- Create: `workers/api/src/db.ts` (concrete DB implementation)
- Modify: `workers/api/src/index.ts` (initialize DB)
- Modify: `workers/api/package.json` (add pg dependency)
- Modify all route files (replace TODO comments with real DB calls)

**Step 1: Add postgres dependency**

Cloudflare Workers support `pg` via `nodejs_compat`. Use `@neondatabase/serverless` or `postgres` (both work on edge). Since CockroachDB is Postgres-compatible:

```bash
pnpm -F @saasmaker/api add postgres
```

**Step 2: Write db.ts — implement FeedbackDatabase interface**

`workers/api/src/db.ts`:

Implement the full `FeedbackDatabase` interface from `@saasmaker/db` using the `postgres` client. Each method maps to a SQL query against CockroachDB. Key patterns:

- Use parameterized queries for all user input
- `listFeedback` builds WHERE clauses dynamically based on filters
- `addUpvote`/`removeUpvote` also increment/decrement `feedback.upvote_count` in a transaction
- `upsertUser` uses `INSERT ... ON CONFLICT (email) DO UPDATE`

This is the largest file in the API. Write each method as a direct SQL query — no ORM.

**Step 3: Initialize DB in index.ts**

```typescript
import { createDatabase } from './db';
// Inside fetch handler or as middleware:
// const db = createDatabase(c.env.DATABASE_URL);
```

**Step 4: Replace all TODO comments in routes with real DB calls**

Go through each route file and replace `// TODO: db.xxx()` with actual calls.

**Step 5: Test against local CockroachDB**

```bash
cockroach start-single-node --insecure --listen-addr=localhost:26257
cockroach sql --insecure < packages/db/migrations/0001_init.sql
```

Run worker with `DATABASE_URL=postgresql://root@localhost:26257/defaultdb` in `.dev.vars`.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: wire CockroachDB implementation for all routes"
```

---

### Task 11: Dashboard — Scaffold Next.js App

**Files:**
- Create: `apps/dashboard/` (via create-next-app)
- Modify: `apps/dashboard/package.json`
- Create: `apps/dashboard/tailwind.config.ts`

**Step 1: Scaffold**

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker/apps
pnpm create next-app dashboard --typescript --tailwind --app --src-dir=false --import-alias="@/*" --no-eslint
```

**Step 2: Update package.json name**

```json
{
  "name": "@saasmaker/dashboard",
  ...
}
```

**Step 3: Install shadcn/ui**

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker/apps/dashboard
pnpx shadcn@latest init
```

Select: New York style, neutral color, CSS variables.

**Step 4: Add commonly needed shadcn components**

```bash
pnpx shadcn@latest add button card input label select badge tabs dialog dropdown-menu table textarea toast
```

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: scaffold Next.js dashboard with shadcn/ui + Tailwind"
```

---

### Task 12: Dashboard — Auth.js Google OAuth

**Files:**
- Create: `apps/dashboard/app/api/auth/[...nextauth]/route.ts`
- Create: `apps/dashboard/lib/auth.ts`
- Create: `apps/dashboard/middleware.ts`
- Create: `apps/dashboard/app/login/page.tsx`

**Step 1: Install Auth.js**

```bash
pnpm -F @saasmaker/dashboard add next-auth@beta
```

**Step 2: Create auth config**

`apps/dashboard/lib/auth.ts`:

```typescript
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
```

**Step 3: Create API route**

`apps/dashboard/app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from '@/lib/auth';
export const { GET, POST } = handlers;
```

**Step 4: Create middleware for protected routes**

`apps/dashboard/middleware.ts`:

```typescript
export { auth as middleware } from '@/lib/auth';

export const config = {
  matcher: ['/projects/:path*'],
};
```

**Step 5: Create login page**

`apps/dashboard/app/login/page.tsx`:

```tsx
import { signIn } from '@/lib/auth';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-2xl font-bold">SaaS Maker</h1>
        <p className="text-muted-foreground">Sign in to manage your feedback</p>
        <form action={async () => {
          'use server';
          await signIn('google', { redirectTo: '/projects' });
        }}>
          <button type="submit" className="w-full rounded-lg bg-primary px-4 py-3 text-primary-foreground">
            Sign in with Google
          </button>
        </form>
      </div>
    </div>
  );
}
```

**Step 6: Set env vars**

Create `apps/dashboard/.env.local`:
```
AUTH_SECRET=<generate with: openssl rand -base64 32>
AUTH_GOOGLE_ID=<your google client id>
AUTH_GOOGLE_SECRET=<your google client secret>
```

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: add Google OAuth with Auth.js"
```

---

### Task 13: Dashboard — Projects List + Create

**Files:**
- Create: `apps/dashboard/app/projects/page.tsx`
- Create: `apps/dashboard/app/projects/new/page.tsx`
- Create: `apps/dashboard/lib/api.ts` (API client helper)

**Step 1: Create API client helper**

`apps/dashboard/lib/api.ts`:

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

**Step 2: Build projects list page**

`apps/dashboard/app/projects/page.tsx`:

Server component that fetches projects from API. Displays as a grid of cards. Each card shows project name, feedback count badge, and link to inbox. Plus a "New Project" button.

**Step 3: Build create project page**

Simple form with project name input → POST to API → redirect to new project's inbox.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add projects list and create pages"
```

---

### Task 14: Dashboard — Inbox View

**Files:**
- Create: `apps/dashboard/app/projects/[slug]/page.tsx`
- Create: `apps/dashboard/components/feedback-table.tsx`
- Create: `apps/dashboard/components/feedback-detail.tsx`
- Create: `apps/dashboard/components/filter-bar.tsx`

**Step 1: Build filter bar component**

Dropdowns for type (bug/feature/feedback/all) and status (new/in_progress/done/dismissed/all). Sort toggle (newest/most upvoted). Uses shadcn `Select` components. Updates URL search params.

**Step 2: Build feedback table component**

Table using shadcn `Table` component. Columns: type badge, title, submitter email, upvotes count, status badge, created date. Clickable rows open detail panel.

**Step 3: Build feedback detail component**

Sheet/dialog that shows full feedback: title, description, image (if any), submitter info, upvote count. Status dropdown to change status. Delete button with confirmation.

**Step 4: Build inbox page**

`apps/dashboard/app/projects/[slug]/page.tsx`:

Composes filter bar + feedback table + detail panel. Fetches project by slug, then feedback list with current filters. Includes the project API key display (copyable) for SDK integration.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add inbox view with filters, table, and detail panel"
```

---

### Task 15: Dashboard — Settings Page

**Files:**
- Create: `apps/dashboard/app/projects/[slug]/settings/page.tsx`

**Step 1: Build settings page**

Shows:
- Project name (editable)
- API key (copyable, with regenerate button)
- SDK installation snippet (code block with copy)
- Email notification toggle (future, placeholder)
- Danger zone: delete project with confirmation dialog

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: add project settings page"
```

---

### Task 16: Feedback Widget — Core Component

**Files:**
- Create: `packages/feedback-widget/package.json`
- Create: `packages/feedback-widget/tsconfig.json`
- Create: `packages/feedback-widget/src/FeedbackWidget.tsx`
- Create: `packages/feedback-widget/src/index.ts`
- Create: `packages/feedback-widget/src/styles/widget.module.css`
- Create: `packages/feedback-widget/src/api.ts`

**Step 1: Create package.json**

```json
{
  "name": "@saasmaker/feedback",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts --external react"
  },
  "dependencies": {
    "@saasmaker/shared-types": "workspace:*"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  },
  "devDependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "tsup": "^8.0.0",
    "typescript": "^5.9.3"
  }
}
```

**Step 2: Create API client**

`packages/feedback-widget/src/api.ts`:

```typescript
const DEFAULT_API_BASE = 'https://api.saasmaker.dev';

export function createApiClient(projectId: string, apiBaseUrl?: string) {
  const base = apiBaseUrl || DEFAULT_API_BASE;

  return {
    async submitFeedback(data: {
      type: string; title: string; description: string;
      image_url?: string; submitter_email: string; submitter_name?: string;
    }) {
      const res = await fetch(`${base}/v1/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Project-Key': projectId },
        body: JSON.stringify(data),
      });
      return res.json();
    },

    async listFeedback(params?: { type?: string; sort?: string; page?: number }) {
      const query = new URLSearchParams({ ...(params as Record<string, string>) }).toString();
      const res = await fetch(`${base}/v1/feedback?${query}`, {
        headers: { 'X-Project-Key': projectId },
      });
      return res.json();
    },

    async uploadImage(file: File) {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${base}/v1/upload`, {
        method: 'POST',
        headers: { 'X-Project-Key': projectId },
        body: form,
      });
      return res.json();
    },

    async upvote(feedbackId: string) {
      const res = await fetch(`${base}/v1/feedback/${feedbackId}/upvote`, {
        method: 'POST',
        credentials: 'include',
      });
      return res;
    },

    async removeUpvote(feedbackId: string) {
      const res = await fetch(`${base}/v1/feedback/${feedbackId}/upvote`, {
        method: 'DELETE',
        credentials: 'include',
      });
      return res;
    },

    getAuthUrl() {
      return `${base}/v1/auth/google`;
    },
  };
}
```

**Step 3: Build FeedbackWidget component**

`packages/feedback-widget/src/FeedbackWidget.tsx`:

Main component that renders:
1. Floating trigger button (configurable position, color, text)
2. Modal overlay with two tabs: Submit and Browse
3. Submit form: type selector, title, description, image drop zone, email/name fields
4. Browse list: scrollable feedback items with upvote buttons

Uses CSS modules for scoped styling. No Tailwind.

**Step 4: Create index.ts barrel export**

```typescript
export { FeedbackWidget } from './FeedbackWidget';
export type { FeedbackWidgetProps } from '@saasmaker/shared-types';
```

**Step 5: Build and verify**

```bash
pnpm install && pnpm build:widget
```

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add feedback widget React component"
```

---

### Task 17: Integration — Wire DB to All Routes

**Files:**
- Modify: `workers/api/src/routes/auth.ts` (real user upsert + session)
- Modify: `workers/api/src/routes/projects.ts` (real DB calls)
- Modify: `workers/api/src/routes/feedback.ts` (real DB calls + email)
- Modify: `workers/api/src/middleware/auth.ts` (real session/API key lookup)

**Step 1: Replace all TODO placeholders with real DB calls**

Work through each route file systematically. The DB interface is already defined — call each method and handle errors.

**Step 2: Test full flow locally**

1. Start CockroachDB locally
2. Run migration
3. Start worker (`pnpm dev:api`)
4. Start dashboard (`pnpm dev:dashboard`)
5. Sign in with Google → create project → get API key
6. Use curl to submit feedback with API key
7. Verify it shows in dashboard inbox
8. Test upvote flow

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: wire all routes to CockroachDB"
```

---

### Task 18: End-to-End Testing

**Files:**
- Create: `tests/e2e/feedback-flow.test.ts`

**Step 1: Write integration tests**

Test the core flows:
- Create project → get API key
- Submit feedback via API key → verify in DB
- List feedback → verify response shape
- Upvote feedback (mock auth) → verify count incremented
- Update status → verify changed
- Delete feedback → verify gone
- Image upload → verify R2 key returned

Use vitest + fetch against local worker.

**Step 2: Run tests**

```bash
pnpm test
```

**Step 3: Commit**

```bash
git add -A && git commit -m "test: add e2e tests for feedback flow"
```

---

### Task 19: Deploy

**Files:**
- Create: `workers/api/.dev.vars.example`
- Modify: `workers/api/wrangler.toml` (add secrets reference)

**Step 1: Create R2 bucket**

```bash
wrangler r2 bucket create saasmaker-feedback-images
```

**Step 2: Set worker secrets**

```bash
cd workers/api
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put SESSION_SECRET
wrangler secret put DATABASE_URL
wrangler secret put RESEND_API_KEY
```

**Step 3: Deploy worker**

```bash
pnpm -F @saasmaker/api deploy
```

**Step 4: Deploy dashboard to Vercel**

```bash
cd apps/dashboard && vercel
```

**Step 5: Verify production flow**

- Visit dashboard URL → sign in → create project
- Use API key to submit feedback via curl
- Verify email notification received
- Verify feedback appears in inbox

**Step 6: Commit deploy config**

```bash
git add -A && git commit -m "chore: add deployment config and env examples"
```

---

## Summary

| Task | What | Depends On |
|------|------|-----------|
| 1 | Scaffold monorepo | — |
| 2 | Shared types | 1 |
| 3 | DB package | 2 |
| 4 | Workers API scaffold | 1 |
| 5 | OAuth routes | 4 |
| 6 | Project routes | 4, 5 |
| 7 | Feedback routes | 4, 5, 6 |
| 8 | Image upload (R2) | 4 |
| 9 | Email notifications | 4 |
| 10 | Wire CockroachDB | 3, 5, 6, 7 |
| 11 | Dashboard scaffold | 1 |
| 12 | Dashboard auth | 11 |
| 13 | Projects pages | 12 |
| 14 | Inbox view | 13 |
| 15 | Settings page | 13 |
| 16 | Feedback widget | 2 |
| 17 | Wire DB to routes | 10 |
| 18 | E2E tests | 17 |
| 19 | Deploy | 18 |

**Parallelizable work:** Tasks 4-9 (API routes) can proceed in parallel with Tasks 11-15 (dashboard) and Task 16 (widget). Task 10 and 17 are the integration points.
