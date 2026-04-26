---
title: Integration Guide
description: Step-by-step guide to integrate Foundry into your Next.js or Vite project.
---

Add Foundry to any JavaScript project in under 5 minutes. This guide covers analytics, feedback, and automatic SDK updates.

## Install the SDK

```bash
pnpm add @foundry/sdk
# or: npm install @foundry/sdk
```

## Create your API key

1. Go to [app.sassmaker.com](https://app.sassmaker.com) and create a project
2. Copy the project API key (`pk_...`)
3. Add it to your environment

## Next.js (App Router)

### 1. Environment variable

```bash
# .env.local
NEXT_PUBLIC_SAASMAKER_API_KEY=pk_your_key_here
```

### 2. SDK client

```typescript
// src/lib/saasmaker.ts
import { SaaSMakerClient } from '@foundry/sdk';

export const saasmaker = new SaaSMakerClient({
  apiKey: process.env.NEXT_PUBLIC_SAASMAKER_API_KEY!,
  baseUrl: 'https://api.sassmaker.com',
});
```

### 3. Analytics (page view tracking)

```typescript
// src/components/SaasMakerAnalytics.tsx
'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { saasmaker } from '@/lib/saasmaker';

export function SaasMakerAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    saasmaker.analytics.track({ name: 'page_view', url: pathname });
  }, [pathname]);

  return null;
}
```

Add to your root layout:

```typescript
// src/app/layout.tsx
import { SaasMakerAnalytics } from '@/components/SaasMakerAnalytics';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SaasMakerAnalytics />
        {children}
      </body>
    </html>
  );
}
```

## Vite + React

### 1. Environment variable

```bash
# .env.local
VITE_SAASMAKER_API_KEY=pk_your_key_here
```

### 2. SDK client

```typescript
// src/lib/saasmaker.ts
import { SaaSMakerClient } from '@foundry/sdk';

export const saasmaker = new SaaSMakerClient({
  apiKey: import.meta.env.VITE_SAASMAKER_API_KEY,
  baseUrl: 'https://api.sassmaker.com',
});
```

### 3. Analytics (page view tracking)

If you use React Router:

```typescript
// src/components/PageViewTracker.tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { saasmaker } from '../lib/saasmaker';

export function PageViewTracker() {
  const location = useLocation();

  useEffect(() => {
    saasmaker.analytics.track({ name: 'page_view', url: location.pathname });
  }, [location.pathname]);

  return null;
}
```

Add inside your `<BrowserRouter>`:

```tsx
<BrowserRouter>
  <PageViewTracker />
  <Routes>
    {/* your routes */}
  </Routes>
</BrowserRouter>
```

If you don't use a router, track on mount:

```typescript
useEffect(() => {
  saasmaker.analytics.track({ name: 'page_view', url: window.location.pathname });
}, []);
```

## Automatic SDK Updates

Add this Dependabot config to automatically receive PRs when new SDK versions are released. Dependabot runs for **free** — it doesn't count against your GitHub Actions minutes.

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule:
      interval: weekly
      day: monday
    allow:
      - dependency-name: "@foundry/sdk"
    commit-message:
      prefix: "deps"
    open-pull-requests-limit: 1
```

This checks for SDK updates every Monday and opens a PR if a new version is available.

## Using the CLI

You can also initialize a project via the CLI:

```bash
npx @foundry/cli login
npx @foundry/cli init
```

This creates a `.saasmaker.json` file linking your directory to a project. See the [CLI docs](/sdk/cli) for more.

## What's next?

- [Submit feedback](/sdk/javascript#feedback) from your app
- [Collect waitlist signups](/sdk/javascript#waitlist)
- [Display testimonials](/sdk/javascript#testimonials)
- [Publish a public roadmap](/sdk/javascript#roadmap)
- [Track custom events](/sdk/javascript#analytics)
