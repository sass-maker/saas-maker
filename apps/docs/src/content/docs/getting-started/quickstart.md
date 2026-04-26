---
title: Quickstart
description: Get up and running with Foundry in under 5 minutes.
---

## 1. Install the CLI

```bash
npm install -g @foundry/cli
```

## 2. Log in

```bash
fnd login
```

Opens your browser for Google OAuth. Your session token is saved to `~/.saasmaker/config.json`.

## 3. Create a project

```bash
fnd projects create
```

Follow the prompt to name your project. This generates a unique API key (starts with `pk_`).

## 4. Link your app directory

```bash
cd ~/my-app
fnd init
```

Select your project from the list. This creates a `.saasmaker.json` config in your project root.

## 5. Check your setup

```bash
fnd keys     # show your API key
fnd status   # show project stats
```

## 6. Integrate the SDK

```bash
npm install @foundry/sdk
```

```typescript
import { SaaSMakerClient } from '@foundry/sdk';

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
- [Authentication](/getting-started/authentication) — understand API keys vs session tokens
- [Feedback](/services/feedback) — full feedback API reference
- [JavaScript SDK](/sdk/javascript) — all available SDK methods
