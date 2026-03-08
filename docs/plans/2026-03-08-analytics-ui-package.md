# @saas-maker/analytics-ui Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a self-contained React analytics dashboard component (`@saas-maker/analytics-ui`) that works with just an API key prop — no Tailwind, no session tokens, no external dependencies beyond React.

**Architecture:** New package at `packages/analytics-ui` with inline styles. Backend gets a new `requireApiKeyOrSession` middleware so the `/dashboard` endpoint accepts both session tokens (for the dashboard app) and API keys (for the SDK component). The dashboard app then imports from this package instead of its local component.

**Tech Stack:** React, recharts (bundled), tsup, inline CSS-in-JS styles

---

### Task 1: Add API key auth to analytics dashboard endpoint

**Files:**
- Modify: `workers/api/src/middleware/auth.ts`
- Modify: `workers/api/src/routes/analytics.ts:153-169`
- Create: `workers/api/src/middleware/__tests__/auth.test.ts`

**Step 1: Create `requireApiKeyOrSession` middleware**

In `workers/api/src/middleware/auth.ts`, add a new middleware that tries `X-Project-Key` first, then falls back to `requireSession` logic. If API key is present, set `projectId` on context (skip ownership check since key IS the project). If Bearer token is present, use existing session flow.

```typescript
export const requireApiKeyOrSession = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const apiKey = c.req.header('X-Project-Key');
    if (apiKey) {
      const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
      const project = await db.getProjectByApiKey(apiKey);
      if (!project) return c.json({ error: 'Invalid API key' }, 401);
      c.set('projectId', project.id);
      c.set('project', project);
      return next();
    }

    // Fall back to session auth
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.slice(7);
    const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

    if (token.startsWith('sm_')) {
      const cliToken = await db.getCliTokenUser(token);
      if (!cliToken) return c.json({ error: 'Unauthorized' }, 401);
      c.set('userId', cliToken.user_id);
      return next();
    }

    const payload = await decryptAuthJsJwe(token, c.env.AUTH_SECRET);
    if (!payload) return c.json({ error: 'Unauthorized' }, 401);

    const user = await db.upsertUser({
      id: payload.sub,
      email: payload.email,
      name: payload.name || null,
      avatar_url: payload.picture || null,
    });
    c.set('userId', user.id);
    await next();
  }
);
```

**Step 2: Update `/dashboard` route to use new middleware**

In `workers/api/src/routes/analytics.ts`, change the `/dashboard` route:
- Replace `requireSession` with `requireApiKeyOrSession`
- If `projectId` is already set (API key path), use it directly — skip the ownership check
- If `userId` is set (session path), keep existing ownership check

```typescript
analytics.get('/dashboard', requireApiKeyOrSession, async (c) => {
  let projectId = c.get('projectId');

  if (!projectId) {
    // Session auth path — need ownership check
    const userId = c.get('userId')!;
    projectId = c.req.query('project_id');
    if (!projectId) return c.json({ error: 'project_id is required' }, 400);

    const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
    const project = await db.getProjectById(projectId);
    if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);
  }

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const period = c.req.query('period') || '30d';
  const since = parsePeriod(period);
  const includeBots = c.req.query('include_bots') === 'true';
  const isToday = period === 'today';

  const dashboard = await db.getAnalyticsDashboard(projectId, since, includeBots, isToday);
  return c.json(dashboard);
});
```

**Step 3: Verify the API compiles**

Run: `cd /Users/sarthakagrawal/Desktop/saas-maker && pnpm -F @saas-maker/api typecheck`
Expected: No type errors

**Step 4: Commit**

```bash
git add workers/api/src/middleware/auth.ts workers/api/src/routes/analytics.ts
git commit -m "feat: add API key auth to analytics dashboard endpoint"
```

---

### Task 2: Scaffold `packages/analytics-ui` package

**Files:**
- Create: `packages/analytics-ui/package.json`
- Create: `packages/analytics-ui/tsconfig.json`
- Create: `packages/analytics-ui/tsup.config.ts`
- Create: `packages/analytics-ui/src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@saas-maker/analytics-ui",
  "version": "0.1.0",
  "publishConfig": { "access": "public" },
  "files": ["dist"],
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "recharts": "^3.7.0"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  },
  "devDependencies": {
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "tsup": "^8.0.0",
    "typescript": "^5.9.3"
  }
}
```

**Step 2: Create tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: ['react', 'react-dom'],
});
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM"],
    "jsx": "react-jsx",
    "strict": true,
    "outDir": "dist",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src"]
}
```

**Step 4: Create src/index.ts (barrel export)**

```typescript
export { AnalyticsDashboard } from './AnalyticsDashboard';
export type { AnalyticsDashboardProps } from './AnalyticsDashboard';
```

**Step 5: Install dependencies**

Run: `cd /Users/sarthakagrawal/Desktop/saas-maker && pnpm install`

**Step 6: Commit**

```bash
git add packages/analytics-ui/
git commit -m "feat: scaffold @saas-maker/analytics-ui package"
```

---

### Task 3: Create theme system and style utilities

**Files:**
- Create: `packages/analytics-ui/src/styles.ts`

**Step 1: Create inline style helpers with dark/light theme support**

All styles are plain `React.CSSProperties` objects. Two themes: dark (zinc-based, matching current dashboard) and light. Every Tailwind class in the original component maps to an inline style here.

```typescript
export type Theme = 'light' | 'dark';

export interface ThemeColors {
  bg: string;
  bgCard: string;
  bgCardHover: string;
  border: string;
  text: string;
  textMuted: string;
  textDim: string;
  accent: string;
  accentSecondary: string;
  error: string;
  chartGrid: string;
}

const darkColors: ThemeColors = {
  bg: '#09090b',
  bgCard: '#18181b',
  bgCardHover: 'rgba(39,39,42,0.5)',
  border: '#27272a',
  text: '#fafafa',
  textMuted: '#a1a1aa',
  textDim: '#71717a',
  accent: '#3b82f6',
  accentSecondary: '#8b5cf6',
  error: '#f87171',
  chartGrid: '#27272a',
};

const lightColors: ThemeColors = {
  bg: '#ffffff',
  bgCard: '#f4f4f5',
  bgCardHover: 'rgba(228,228,231,0.5)',
  border: '#e4e4e7',
  text: '#09090b',
  textMuted: '#52525b',
  textDim: '#a1a1aa',
  accent: '#3b82f6',
  accentSecondary: '#8b5cf6',
  error: '#ef4444',
  chartGrid: '#e4e4e7',
};

export function getColors(theme: Theme): ThemeColors {
  return theme === 'dark' ? darkColors : lightColors;
}

export const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

export const tooltipStyle = (theme: Theme) => ({
  backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
  border: `1px solid ${theme === 'dark' ? '#3f3f46' : '#e4e4e7'}`,
  borderRadius: '6px',
  color: theme === 'dark' ? '#fafafa' : '#09090b',
});
```

**Step 2: Commit**

```bash
git add packages/analytics-ui/src/styles.ts
git commit -m "feat: add theme system for analytics-ui"
```

---

### Task 4: Create the data fetcher hook

**Files:**
- Create: `packages/analytics-ui/src/use-analytics.ts`

**Step 1: Create the hook**

Self-contained fetch hook that uses `X-Project-Key` header. No external dependencies. Defines the `AnalyticsDashboard` type inline (copy from shared-types) to avoid adding a workspace dependency to a published package.

```typescript
export type Period = 'today' | '7d' | '30d' | '90d' | 'all';

// Inline type definition (mirrors @saas-maker/shared-types AnalyticsDashboard)
export interface DashboardSummary {
  page_views: number;
  unique_visitors: number;
  bounce_rate: number;
  avg_session_pages: number;
  bot_count: number;
  bot_percentage: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  timeseries: { date: string; views: number; visitors: number }[];
  pages: { pathname: string; views: number }[];
  referrers: { referrer: string; count: number }[];
  countries: { country: string; count: number }[];
  devices: { device: string; count: number }[];
  browsers: { browser: string; count: number }[];
  os: { os: string; count: number }[];
  events: { name: string; count: number }[];
  bots: { name: string; count: number }[];
}

const DEFAULT_API_BASE = 'https://api.sassmaker.com';

export function useAnalytics(apiKey: string, period: Period, apiBaseUrl?: string) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const base = apiBaseUrl || DEFAULT_API_BASE;
    const url = `${base}/v1/analytics/dashboard?period=${period}`;

    fetch(url, {
      headers: { 'X-Project-Key': apiKey },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json as DashboardData);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [apiKey, period, apiBaseUrl]);

  return { loading, error, data };
}
```

(Add `import { useState, useEffect } from 'react'` at top.)

**Step 2: Commit**

```bash
git add packages/analytics-ui/src/use-analytics.ts
git commit -m "feat: add useAnalytics data fetcher hook"
```

---

### Task 5: Build the AnalyticsDashboard component

**Files:**
- Create: `packages/analytics-ui/src/AnalyticsDashboard.tsx`

**Step 1: Create the main component**

This is the largest task. Convert all Tailwind classes from `apps/dashboard/.../analytics-content.tsx` to inline `style` props. Use the theme system from Task 3. Use the data hook from Task 4.

Key differences from the dashboard version:
- No `lucide-react` dependency — use simple SVG or Unicode symbols for stat card icons
- No detail drawer (v1 cut)
- No bot toggle (v1 cut)
- No `"use client"` directive (not a Next.js component)
- Period selector built-in
- `apiKey` prop instead of `projectId`
- All inline styles, zero className usage

Props interface:

```typescript
export interface AnalyticsDashboardProps {
  apiKey: string;
  period?: Period;
  theme?: 'light' | 'dark';
  apiBaseUrl?: string;
}
```

Component structure (all sub-components defined in same file):
1. `StatCard` — inline styled card with label, value, optional subtitle
2. `Section` — collapsible section with title
3. `ListTable` — key-value list (countries, events)
4. `PeriodSelector` — toggle buttons for time range
5. `AnalyticsDashboard` — main component wiring it all together

Charts: Same recharts setup as original (AreaChart for timeseries, BarChart for pages/referrers, PieChart for devices/browsers/OS). Tooltip styles use theme-aware colors.

Replace lucide icons with simple inline SVGs (4 icons: eye, users, trending-down, layers).

**Step 2: Verify it builds**

Run: `cd /Users/sarthakagrawal/Desktop/saas-maker && pnpm -F @saas-maker/analytics-ui build`
Expected: Builds successfully, outputs to `packages/analytics-ui/dist/`

**Step 3: Commit**

```bash
git add packages/analytics-ui/src/AnalyticsDashboard.tsx packages/analytics-ui/src/index.ts
git commit -m "feat: implement AnalyticsDashboard component with inline styles"
```

---

### Task 6: Update dashboard app to use the package

**Files:**
- Modify: `apps/dashboard/src/app/projects/[slug]/analytics/analytics-content.tsx`
- Modify: `apps/dashboard/src/app/projects/[slug]/analytics/page.tsx`
- Modify: `apps/dashboard/package.json` (add `@saas-maker/analytics-ui` dependency)

**Step 1: Add workspace dependency**

In `apps/dashboard/package.json`, add:
```json
"@saas-maker/analytics-ui": "workspace:*"
```

Run: `pnpm install`

**Step 2: Create a thin wrapper in analytics-content.tsx**

The dashboard app still uses session auth (not API key), so we need a wrapper that:
- Fetches data using the existing `getClientToken()` + `apiFetchClient()` flow
- Passes the data to the package component OR
- Simply uses the API key from the project record

Since the project's `api_key` is available server-side, the simplest approach: pass the API key from the page.tsx server component to the client component, and use `<AnalyticsDashboard apiKey={apiKey} />` directly.

Update `page.tsx`:
```typescript
import { AnalyticsDashboard } from '@saas-maker/analytics-ui';

export default async function AnalyticsPage({ params }: Props) {
  const { slug } = await params;
  const { project } = await getAuthenticatedProject(slug);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Privacy-friendly page views and custom event tracking."
      />
      <AnalyticsDashboard apiKey={project.api_key} />
    </div>
  );
}
```

Delete or gut `analytics-content.tsx` (the old local component is replaced).

**Step 3: Verify dashboard builds**

Run: `cd /Users/sarthakagrawal/Desktop/saas-maker && pnpm -F @saas-maker/dashboard build`
Expected: Builds successfully

**Step 4: Commit**

```bash
git add apps/dashboard/src/app/projects/\[slug\]/analytics/ apps/dashboard/package.json pnpm-lock.yaml
git commit -m "refactor: use @saas-maker/analytics-ui in dashboard"
```

---

### Task 7: Add build script to root package.json + verify full build

**Files:**
- Modify: `package.json` (root)

**Step 1: Add build script**

In root `package.json` scripts, add:
```json
"build:analytics-ui": "pnpm -F @saas-maker/analytics-ui build"
```

**Step 2: Full build verification**

Run: `cd /Users/sarthakagrawal/Desktop/saas-maker && pnpm -F @saas-maker/analytics-ui build && pnpm -F @saas-maker/dashboard build`
Expected: Both build successfully

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add analytics-ui build script"
```

---

### Task 8: Manual smoke test

**Step 1: Run the dashboard locally**

Run: `cd /Users/sarthakagrawal/Desktop/saas-maker && pnpm -F @saas-maker/analytics-ui build && pnpm -F @saas-maker/dashboard dev`

**Step 2: Navigate to a project's analytics page**

Open browser, go to a project with analytics data. Verify:
- Period selector works
- Timeseries chart renders
- Summary cards show correct data
- Breakdown tables/charts render
- Light/dark theme (if applicable in dashboard context)

**Step 3: Test API key endpoint directly**

```bash
curl -H "X-Project-Key: <a-real-api-key>" "https://api.sassmaker.com/v1/analytics/dashboard?period=30d"
```

Expected: Returns JSON dashboard data (not 401)
