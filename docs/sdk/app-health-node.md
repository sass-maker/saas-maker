---
title: "App Health for Node.js"
description: "Install the SaaS Maker App Health SDK in an Express application."
---

> **Release status:** `@saas-maker/sdk` 0.4.0 is prepared but not yet published.
> This install command becomes active when the App Health production release is approved.

This guide is complete for Node.js 20+ and Express 4+. The App Health client is
included in `@saas-maker/sdk` version 0.4.0 and later.

## 1. Install

```bash
npm install @saas-maker/sdk@^0.4.0
```

Set the project API key in the service environment:

```bash
SAASMAKER_API_KEY=pk_your_project_key
```

Do not expose this server-side key to browser code or commit it to the
repository.

## 2. Add Express middleware

```typescript
import express from 'express';
import { createAppHealth } from '@saas-maker/sdk';

const app = express();
const appHealth = createAppHealth({
  apiKey: requireEnv('SAASMAKER_API_KEY'),
  release: process.env.APP_RELEASE,
});

// Install before routes. Recording happens after the response finishes.
app.use(appHealth.expressMiddleware());

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

app.get('/users/:id', (request, response) => {
  response.json({ id: request.params.id });
});

const server = app.listen(3000);

async function shutdown(signal: string) {
  server.close(async () => {
    await appHealth.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
  console.info(`Received ${signal}; draining App Health.`);
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
```

`expressMiddleware()` calls `next()` immediately. It records the final status
and duration from the response `finish` event and never waits for SaaS Maker on
the application request path. Unmatched requests are dropped because Express
does not provide a normalized route template for them; the SDK never falls back
to their raw URL.

## 3. Verify

```bash
curl -i http://localhost:3000/health
curl -i http://localhost:3000/users/123456?email=private@example.com
```

Open `https://app.sassmaker.com/fleet/app-health`, select the project, and use
**Last hour**. You should see `GET /health` and `GET /users/:id`. You must not
see `123456`, `email`, or the query value.

## Non-Express Node.js

For another framework, record the framework's route template after the
response completes:

```typescript
const startedAt = performance.now();

try {
  // Run the framework handler.
} finally {
  appHealth.record({
    method: request.method,
    route: '/jobs/:id',
    statusCode: response.statusCode,
    durationMs: performance.now() - startedAt,
  });
}
```

Pass a route template, not a raw URL. `record()` is synchronous and only queues
the summary.

## Diagnostics

```typescript
console.info(appHealth.diagnostics());
```

The snapshot reports queued and sent events, invalid or overflow drops,
delivery drops, failed and retried batches, and the last delivery error. These
counters are local diagnostics; they contain no request data.

## Optional configuration

```typescript
const appHealth = createAppHealth({
  apiKey: requireEnv('SAASMAKER_API_KEY'),
  release: process.env.GIT_SHA,
  environment: 'production',
  surface: 'public-api',
  maxQueueSize: 1_000,
  maxBatchSize: 50,
  flushIntervalMs: 5_000,
  requestTimeoutMs: 2_000,
  maxRetries: 2,
});
```

The defaults are recommended. Delivery failure never throws into an
application request; shutdown should still await `close()` to flush queued
events.
