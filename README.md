# SaaS Maker — Feedback Module

Embeddable feedback collection system: React widget SDK + Cloudflare Workers API + Next.js dashboard.

## Quick Start

### Prerequisites
- Node.js 22+
- pnpm 10+
- CockroachDB (local or cloud)
- Google OAuth credentials
- Resend API key (optional, for email notifications)

### Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Set up the database:
   ```bash
   cockroach sql --insecure < packages/db/migrations/0001_init.sql
   cockroach sql --insecure < packages/db/migrations/0002_sessions.sql
   ```

3. Configure the API worker:
   ```bash
   cp workers/api/.dev.vars.example workers/api/.dev.vars
   # Edit .dev.vars with your credentials
   ```

4. Configure the dashboard:
   ```bash
   cp apps/dashboard/.env.local.example apps/dashboard/.env.local
   # Edit .env.local with your credentials
   ```

5. Build shared packages:
   ```bash
   pnpm build:types && pnpm build:db
   ```

6. Start development:
   ```bash
   # Terminal 1: API
   pnpm dev:api

   # Terminal 2: Dashboard
   pnpm dev:dashboard
   ```

### Widget Usage

```tsx
import { FeedbackWidget } from '@saasmaker/feedback'

<FeedbackWidget projectId="your-project-id" />
```

### Deploy

**API (Cloudflare Workers):**
```bash
cd workers/api
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put SESSION_SECRET
wrangler secret put DATABASE_URL
wrangler secret put RESEND_API_KEY
wrangler deploy
```

**Dashboard (Vercel):**
```bash
cd apps/dashboard
vercel
```

### Project Structure

```
saas-maker/
├── apps/dashboard/           # Next.js 15 dashboard
├── packages/
│   ├── shared-types/         # TypeScript types
│   ├── db/                   # DB schema + interface
│   └── feedback-widget/      # React SDK
├── workers/api/              # Cloudflare Workers + Hono
└── tests/                    # Integration tests
```
