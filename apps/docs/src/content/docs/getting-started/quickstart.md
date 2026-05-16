---
title: Quickstart
description: Get up and running with Foundry in under 5 minutes.
---

## 1. Install the CLI

```bash
npm install -g @saas-maker/cli
```

## 2. Log in

```bash
fnd login
```

Opens your browser for Google OAuth. Your session token is saved to `~/.foundry/config.json`.

## 3. Create a project

```bash
fnd projects create --name "My App"
```

This creates a project and prints its `id`, `slug`, and `project_key` (starts with `pk_`). Treat the `pk_` key as your public-facing API key — the SDK and widgets use it. Drop `--name` to be prompted interactively.

## 4. Link your app directory

```bash
cd ~/my-app
fnd init
```

`fnd init` lists your projects, lets you pick one, and writes a `foundry.json` in the current directory linking the repo to the project.

## 5. Check your setup

```bash
fnd whoami   # show your session user and linked project
fnd keys     # print the linked project key
fnd doctor   # quick health + drift check
```

## 6. Integrate the SDK

```bash
npm install @saas-maker/sdk
```

```typescript
import { SaaSMakerClient } from '@saas-maker/sdk';

const client = new SaaSMakerClient({
  apiKey: 'pk_your_api_key',
  baseUrl: 'https://api.sassmaker.com',
});

await client.feedback.submit({
  title: 'Add dark mode',
  description: 'Would love a dark mode option',
  type: 'feature',
  submitter_email: 'user@example.com',
});
```

Or use `curl` directly:

```bash
curl -X POST https://api.sassmaker.com/v1/feedback \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_your_api_key" \
  -d '{
    "title": "Add dark mode",
    "description": "Would love a dark mode option",
    "type": "feature",
    "submitter_email": "user@example.com"
  }'
```

## Next steps

- [CLI reference](/sdk/cli) — all CLI commands
- [Authentication](/getting-started/authentication) — when to use the API key vs. session token
- [API overview](/api/overview) — base URL, error envelope, pagination, status codes
- [Integration guide](/getting-started/integration) — Next.js / Vite wiring
- [Feedback](/services/feedback), [Analytics](/services/analytics), [Roadmap](/services/roadmap) — per-service references
