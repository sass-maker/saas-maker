# @saas-maker/posthog-client

Typed PostHog wrapper for Foundry-stack apps. Browser + server clients, React provider/hook, and a `.posthog-events.json` schema validator.

## Install

```bash
pnpm add @saas-maker/posthog-client
```

Set env vars:

```bash
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxx
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com  # optional
```

## Browser — Next.js App Router

```tsx
// app/providers.tsx
'use client';
import { PostHogProvider } from '@saas-maker/posthog-client';

export function Providers({ children }) {
  return <PostHogProvider>{children}</PostHogProvider>;
}
```

```tsx
// app/some-page.tsx
'use client';
import { usePostHog, track } from '@saas-maker/posthog-client';

export function Button() {
  const ph = usePostHog();
  return (
    <button onClick={() => track('feedback_submitted', { project_id: 'p1' })}>
      Send
    </button>
  );
}
```

## Typed event registry

Define your events once, get autocomplete + payload type-checking everywhere:

```ts
// posthog-events.d.ts
import type { BaseEventMap } from '@saas-maker/posthog-client';

export interface AppEvents extends BaseEventMap {
  feedback_submitted: { project_id: string; type: 'bug' | 'feature' };
  user_signed_in: { method: 'google' | 'github' };
}
```

```ts
import { track } from '@saas-maker/posthog-client';
import type { AppEvents } from './posthog-events';

track<AppEvents>('feedback_submitted', { project_id: 'p1', type: 'bug' });
// ✗ track<AppEvents>('feedback_submitted', { project_id: 1 }); // type error
```

## Server — Next.js route handler / Workers

```ts
// app/api/track/route.ts
import { createPostHogServer, trackServer, flushServer } from '@saas-maker/posthog-client/server';

createPostHogServer({ apiKey: process.env.POSTHOG_KEY! });

export async function POST() {
  trackServer('user_signed_in', { distinctId: 'user-1', properties: { method: 'google' } });
  await flushServer();
  return Response.json({ ok: true });
}
```

## Schema validator (`.posthog-events.json`)

Validate the foundry event registry from CI / pre-push:

```ts
import { readFileSync } from 'node:fs';
import { validatePostHogSchema } from '@saas-maker/posthog-client/schema';

const raw = JSON.parse(readFileSync('.posthog-events.json', 'utf-8'));
const result = validatePostHogSchema(raw);
if (!result.ok) {
  console.error(result.errors.join('\n'));
  process.exit(1);
}
```

Generate the typed `EventMap` interface from the validated registry:

```ts
import { generateEventMap } from '@saas-maker/posthog-client/schema';
console.log(generateEventMap(result.entries));
```

## API surface

| Symbol | Where | Notes |
|---|---|---|
| `<PostHogProvider>` | `.` | React provider (client-only) |
| `usePostHog()` | `.` | Hook returning the live `PostHog` instance |
| `initPostHog(opts)` | `.` | Manual init for non-React apps |
| `track(name, props)` | `.` | Browser capture |
| `identify(id, props)` | `.` | Browser identify |
| `createPostHogServer(opts)` | `/server` | posthog-node instance |
| `trackServer(name, args)` | `/server` | Server capture |
| `flushServer()` | `/server` | Flush before response ends |
| `validatePostHogSchema(raw)` | `/schema` | Validate registry JSON |
| `generateEventMap(entries)` | `/schema` | Codegen typed EventMap |
