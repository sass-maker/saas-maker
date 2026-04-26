---
title: Analytics Dashboard
description: Embed a full analytics dashboard in your React app with one prop.
---

Drop-in React component that renders a complete analytics dashboard — page views, visitors, bounce rate, top pages, referrers, countries, devices, browsers, and custom events. No Tailwind or external CSS required.

## Installation

```bash
npm install @saas-maker/analytics-ui
```

Peer dependencies: `react` and `react-dom` (v18+).

## Usage

```tsx
import { AnalyticsDashboard } from '@saas-maker/analytics-ui';

function App() {
  return <AnalyticsDashboard apiKey="pk_your_api_key" />;
}
```

The component fetches data from the Foundry API using your project API key and renders the full dashboard inline.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `apiKey` | `string` | — | Your project API key (required) |
| `period` | `'today' \| '7d' \| '30d' \| '90d' \| 'all'` | `'30d'` | Initial time period |
| `theme` | `'light' \| 'dark'` | `'dark'` | Color theme |
| `apiBaseUrl` | `string` | `'https://api.sassmaker.com'` | API base URL (for self-hosted) |

## What it renders

1. **Period selector** — toggle between Today, 7D, 30D, 90D, and All time
2. **Timeseries chart** — page views and visitors over time (area chart)
3. **Summary cards** — page views, unique visitors, bounce rate, pages per session
4. **Breakdown panels** — top pages, top referrers, countries, devices, browsers, operating systems
5. **Custom events** — event counts (only shown when events exist)

## Theming

The component supports dark and light themes. All styles are inline — no CSS imports or Tailwind configuration needed.

```tsx
{/* Dark theme (default) */}
<AnalyticsDashboard apiKey="pk_your_api_key" theme="dark" />

{/* Light theme */}
<AnalyticsDashboard apiKey="pk_your_api_key" theme="light" />
```

## Next.js App Router

The component uses React hooks (client-side only). In Next.js App Router, wrap it in a client component:

```tsx
// analytics-dashboard.tsx
'use client';

import { AnalyticsDashboard } from '@saas-maker/analytics-ui';

export function AnalyticsDashboardWrapper({ apiKey }: { apiKey: string }) {
  return <AnalyticsDashboard apiKey={apiKey} />;
}
```

```tsx
// page.tsx (server component)
import { AnalyticsDashboardWrapper } from './analytics-dashboard';

export default function Page() {
  return <AnalyticsDashboardWrapper apiKey="pk_your_api_key" />;
}
```

## TypeScript

The package exports all types:

```typescript
import type {
  AnalyticsDashboardProps,
  Period,
  DashboardData,
  DashboardSummary,
} from '@saas-maker/analytics-ui';
```
