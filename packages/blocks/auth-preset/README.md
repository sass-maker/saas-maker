# @saas-maker/auth-preset

Foundry-standard wrapper around [better-auth](https://better-auth.com). Bakes in Google provider, secure session cookies, and the D1 adapter so every Foundry app gets the same auth posture in two lines.

## Install

```bash
pnpm add @saas-maker/auth-preset better-auth drizzle-orm
```

## .env.example

```bash
BETTER_AUTH_SECRET=<openssl rand -base64 32>
AUTH_URL=https://app.example.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NODE_ENV=production
```

## Server — Cloudflare Workers / OpenNext

```ts
// lib/auth.ts
import { createAuth } from '@saas-maker/auth-preset';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import * as schema from './auth-schema';

let _auth: ReturnType<typeof createAuth> | null = null;

export function getAuth() {
  if (_auth) return _auth;
  const { env } = getCloudflareContext();
  _auth = createAuth({ d1: env.DB, schema });
  return _auth;
}
```

### Next.js App Router catch-all route

```ts
// app/api/auth/[...all]/route.ts
import { toNextHandler } from '@saas-maker/auth-preset/next';
import { getAuth } from '@/lib/auth';

export const { GET, POST } = toNextHandler(getAuth());
```

## Client — React

```tsx
// app/providers.tsx
'use client';
import { AuthProvider } from '@saas-maker/auth-preset/client';

export function Providers({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}
```

```tsx
'use client';
import { useSession, useAuthClient } from '@saas-maker/auth-preset/client';

export function Header() {
  const { data: session } = useSession();
  const client = useAuthClient();
  if (!session) return <button onClick={() => client.signIn.social({ provider: 'google' })}>Sign in</button>;
  return <button onClick={() => client.signOut()}>Sign out {session.user.email}</button>;
}
```

## Defaults baked in

| Setting | Default |
|---|---|
| Provider | `google` |
| Session cookie name | `foundry.session` |
| `secure` cookie | `true` in production, `false` otherwise |
| `sameSite` | `lax` |
| `httpOnly` | `true` |
| Cross-subdomain cookies | disabled |
| `trustedOrigins` | `[baseURL]` |

Override anything by passing it explicitly to `createAuth({ ... })`.

## Schema

The D1 adapter expects the standard better-auth tables (`user`, `session`, `account`, `verification`). Generate them with:

```bash
pnpm dlx better-auth-cli generate --schema ./src/lib/auth-schema.ts
```

Then run a Drizzle migration to create the tables in D1.
