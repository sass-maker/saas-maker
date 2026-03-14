---
title: Waitlist Widget
description: Embed a waitlist signup form in your React app.
---

Drop-in React component for collecting waitlist signups. Works with the Waitlist service API.

## Installation

```bash
npm install @saas-maker/waitlist
```

## Usage

```tsx
import { WaitlistWidget } from '@saas-maker/waitlist';

function App() {
  return (
    <WaitlistWidget
      projectId="pk_your_api_key"
      apiBaseUrl="https://api.sassmaker.com"
    />
  );
}
```

## API

The widget calls these endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/waitlist` | Sign up (email required) |
| GET | `/v1/waitlist/count` | Get total signups |

## SDK Alternative

```typescript
import { SaaSMakerClient } from '@saas-maker/sdk';

const client = new SaaSMakerClient({ apiKey: 'pk_your_api_key' });

// Add to waitlist
await client.waitlist.join({ email: 'user@example.com' });

// Get count
const { count } = await client.waitlist.getCount();
```

## CLI

```bash
saasmaker waitlist list
saasmaker waitlist count
saasmaker waitlist delete <id>
```
