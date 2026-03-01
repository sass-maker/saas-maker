---
title: Quickstart
description: Get up and running with SaaS Maker in under 5 minutes.
---

## 1. Sign up

Create an account at [app.sassmaker.com](https://app.sassmaker.com). Sign in with Google.

## 2. Create a project

From the dashboard, create a new project. Give it a name and slug. Then go to **Settings** and copy your API key (starts with `pk_`).

## 3. Install the SDK

```bash
npm install @saas-maker/sdk
```

## 4. Collect your first feedback

```typescript
import { SaaSMakerClient } from '@saas-maker/sdk';

const client = new SaaSMakerClient({
  apiKey: 'pk_your_api_key',
  baseUrl: 'https://api.sassmaker.com',
});

// Submit feedback
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

## 5. Use the CLI (optional)

```bash
npm install -g @saas-maker/cli
saasmaker login
```

The CLI opens your browser for Google OAuth. Once authenticated, you can manage projects and services from the terminal.

## Next steps

- [Authentication](/getting-started/authentication) — understand API keys vs session tokens
- [Feedback](/services/feedback) — full feedback API reference
- [JavaScript SDK](/sdk/javascript) — all available SDK methods
