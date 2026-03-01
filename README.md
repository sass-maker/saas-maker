# SaaS Maker

Open-source backend toolkit for SaaS products. Drop-in feedback collection, waitlists, analytics, and vector memory — all behind a single API key.

## Features

- **Feedback Widget** — Embeddable React component for bugs, feature requests, and general feedback with image uploads and voting
- **Waitlist** — Email collection with position tracking and signup counts
- **Analytics** — Privacy-friendly page view and custom event tracking (no cookies)
- **Vector Memory** — Semantic search with pluggable embedding models (Voyage AI, Gemini, Cloudflare Workers AI)
- **Public Feedback Board** — Hosted kanban board for feature requests at `/f/{slug}`

## Quick Start

### 1. Install the feedback widget

```bash
npm install @saasmaker/feedback
```

```tsx
import { FeedbackWidget } from '@saasmaker/feedback'

<FeedbackWidget projectId="pk_your_api_key" />
```

### 2. Add analytics tracking

```html
<script defer src="https://unpkg.com/@saasmaker/analytics-sdk" data-project="pk_your_api_key"></script>
```

### 3. Add a waitlist form

```bash
npm install @saasmaker/waitlist
```

```tsx
import { WaitlistForm } from '@saasmaker/waitlist'

<WaitlistForm projectId="pk_your_api_key" />
```

### 4. Use the CLI

```bash
npx @saasmaker/cli login
npx @saasmaker/cli init
npx @saasmaker/cli status
```

## Packages

| Package | Description |
|---------|-------------|
| [`@saasmaker/feedback`](packages/feedback-widget/) | React feedback widget |
| [`@saasmaker/waitlist`](packages/waitlist-widget/) | React waitlist form |
| [`@saasmaker/analytics-sdk`](packages/analytics-sdk/) | Analytics tracking script |
| [`@saasmaker/cli`](packages/cli/) | Project management CLI |
| [`@saasmaker/shared-types`](packages/shared-types/) | Shared TypeScript types |
| [`@saasmaker/db`](packages/db/) | Database layer |

## Monorepo Structure

```
apps/dashboard/       # Next.js admin dashboard
workers/api/          # Cloudflare Workers API (Hono)
packages/
  shared-types/       # TypeScript type definitions
  db/                 # Database queries + migrations
  feedback-widget/    # React feedback component
  waitlist-widget/    # React waitlist component
  analytics-sdk/      # Analytics tracking script
  cli/                # CLI tool
```

## Self-Hosting

### Prerequisites
- Node.js 22+, pnpm 10+
- CockroachDB (local or cloud)
- Google OAuth credentials

### Setup

```bash
pnpm install
cockroach sql --insecure < packages/db/migrations/0001_init.sql
cp workers/api/.dev.vars.example workers/api/.dev.vars
cp apps/dashboard/.env.local.example apps/dashboard/.env.local
pnpm build:types && pnpm build:db
```

### Development

```bash
# Terminal 1: API
pnpm dev:api

# Terminal 2: Dashboard
pnpm dev:dashboard
```

## API Authentication

- **SDK/Widget endpoints** — `X-Project-Key` header with your project API key
- **Dashboard endpoints** — Bearer token (session auth via Auth.js)
- **Public endpoints** — No auth required (e.g., public feedback board)
