---
title: Integration Guide
description: Step-by-step guide to integrate Foundry into your Next.js or Vite project.
---

Add Foundry to any JavaScript project in under 5 minutes. This guide covers the SDK setup, feedback, and automatic SDK updates.

## Install the SDK

```bash
pnpm add @saas-maker/sdk
# or: npm install @saas-maker/sdk
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
import { SaaSMakerClient } from '@saas-maker/sdk';

export const saasmaker = new SaaSMakerClient({
  apiKey: process.env.NEXT_PUBLIC_SAASMAKER_API_KEY!,
  baseUrl: 'https://api.sassmaker.com',
});
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
import { SaaSMakerClient } from '@saas-maker/sdk';

export const saasmaker = new SaaSMakerClient({
  apiKey: import.meta.env.VITE_SAASMAKER_API_KEY,
  baseUrl: 'https://api.sassmaker.com',
});
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
      - dependency-name: "@saas-maker/sdk"
    commit-message:
      prefix: "deps"
    open-pull-requests-limit: 1
```

This checks for SDK updates every Monday and opens a PR if a new version is available.

## Using the CLI

You can also initialize a project via the CLI:

```bash
npx @saas-maker/cli login
npx @saas-maker/cli init
```

This creates a `foundry.json` file linking your directory to a project. See the [CLI docs](/sdk/cli) for more.

## What's next?

- [Submit feedback](/sdk/javascript#feedback) from your app
- [Collect waitlist signups](/sdk/javascript#waitlist)
- [Display testimonials](/sdk/javascript#testimonials)
- [Publish a public roadmap](/sdk/javascript#roadmap)
