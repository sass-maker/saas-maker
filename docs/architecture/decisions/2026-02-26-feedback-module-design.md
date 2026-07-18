# Feedback Module — Design Document

**Date:** 2026-02-26
**Status:** Approved
**Module:** First module of saas-maker platform

## Overview

Embeddable feedback collection system. App owners embed a React widget in their apps to collect bug reports, feature requests, and general feedback. They view and manage submissions via a dashboard. Users can browse and upvote existing feedback (requires Google OAuth). Submissions are anonymous (no auth, email required).

## Architecture

```
Consumer's App                    Dashboard (Next.js)
<FeedbackWidget                   - Google OAuth (owners)
  projectId="xxx"/>               - Inbox view
       |                          - Status management
       v                          - Upvote counts
  ┌──────────────────────────────────────────┐
  │  Cloudflare Workers API (Hono)           │
  │  Public: API key auth                    │
  │  Dashboard: Google OAuth session         │
  ├──────────────────────────────────────────┤
  │  Cloudflare R2   │   CockroachDB        │
  │  (images)        │   (all data)         │
  └──────────────────┴──────────────────────┘
                          │
                    Resend (emails)
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| Dashboard | Next.js 15, App Router |
| UI | shadcn/ui + Tailwind |
| API | Cloudflare Workers + Hono |
| Database | CockroachDB (Postgres-compatible) |
| Image storage | Cloudflare R2 (10GB free) |
| Auth (dashboard + upvotes) | Auth.js (NextAuth v5), Google OAuth |
| Widget auth | API key per project |
| Email | Resend (3k/month free) |
| Package manager | pnpm workspaces |

## Data Model

```sql
users
  id              UUID PK
  email           TEXT UNIQUE NOT NULL
  name            TEXT
  avatar_url      TEXT
  created_at      TIMESTAMPTZ DEFAULT now()

projects
  id              UUID PK
  name            TEXT NOT NULL
  slug            TEXT UNIQUE NOT NULL
  api_key         TEXT UNIQUE NOT NULL    -- pk_xxxxx
  owner_id        UUID FK -> users NOT NULL
  created_at      TIMESTAMPTZ DEFAULT now()

feedback
  id              UUID PK
  project_id      UUID FK -> projects NOT NULL
  type            TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'feedback'))
  status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'done', 'dismissed'))
  title           TEXT NOT NULL
  description     TEXT NOT NULL
  image_url       TEXT
  submitter_email TEXT NOT NULL
  submitter_name  TEXT
  upvote_count    INT DEFAULT 0
  created_at      TIMESTAMPTZ DEFAULT now()

upvotes
  id              UUID PK
  feedback_id     UUID FK -> feedback NOT NULL
  user_id         UUID FK -> users NOT NULL
  created_at      TIMESTAMPTZ DEFAULT now()
  UNIQUE(feedback_id, user_id)
```

## API Design

### Public endpoints (API key auth via X-Project-Key header)

```
POST   /v1/feedback                 — Submit feedback (+ optional image)
GET    /v1/feedback?projectId=xxx   — List feedback (browse tab)
POST   /v1/feedback/:id/upvote      — Upvote (requires Google OAuth)
DELETE /v1/feedback/:id/upvote      — Remove upvote
POST   /v1/upload                   — Upload image to R2
```

### Dashboard endpoints (Google OAuth session)

```
GET    /v1/projects                 — List owner's projects
POST   /v1/projects                 — Create project (returns projectId + API key)
PATCH  /v1/projects/:id             — Update project settings
DELETE /v1/projects/:id             — Delete project
GET    /v1/projects/:id/feedback    — Inbox (filterable, sortable)
PATCH  /v1/feedback/:id             — Update status
DELETE /v1/feedback/:id             — Delete feedback
```

### Auth

```
GET    /v1/auth/google              — Initiate OAuth
GET    /v1/auth/google/callback     — OAuth callback
GET    /v1/auth/session             — Get current session
POST   /v1/auth/logout              — Clear session
```

### Query params for inbox

```
?type=bug|feature|feedback
&status=new|in_progress|done|dismissed
&sort=newest|upvotes
&page=1
```

## Widget SDK

**Package:** `@saas-maker/feedback` (monorepo package, not published to npm in v1)

```tsx
import { FeedbackWidget } from '@saas-maker/feedback'

// Minimal
<FeedbackWidget projectId="abc123" />

// Full options
<FeedbackWidget
  projectId="abc123"
  userEmail="user@example.com"    // prefill + lock email
  userName="Sarthak"              // prefill name
  types={['bug', 'feature']}     // restrict categories
  position="bottom-right"         // bottom-right | bottom-left
  theme="light"                   // light | dark | auto
  accentColor="#1464ff"           // brand color
  triggerText="Feedback"          // button label
/>
```

### Widget behavior

- Floating button (fixed position) -> opens modal overlay
- Two tabs: Submit and Browse
- **Submit tab (no auth):**
  - Type selector (bug/feature/feedback)
  - Title, description, optional image upload
  - Email: prefilled + locked if `userEmail` prop provided, required field otherwise
  - Optional name field
- **Browse tab:**
  - Scrollable list of feedback with upvote buttons and type filters
  - Upvote click -> Google OAuth popup if not logged in -> upvote registered
  - Already logged in -> upvote directly

### Technical constraints

- Scoped CSS (CSS modules or shadow DOM) — no Tailwind leaking into host app
- Talks directly to Workers API via project API key
- Auth cookies scoped to API domain
- Bundle target: <15KB gzipped
- Peer dependency: react >= 18

## Dashboard Pages

```
/login                    — Google OAuth sign-in
/projects                 — List projects, create new
/projects/:slug           — Inbox view (main page)
/projects/:slug/settings  — API key, notifications, delete
```

### Inbox features

- Filter by type (bug/feature/feedback) and status (new/in_progress/done/dismissed)
- Sort by newest or most upvoted
- Click row -> detail panel (description, image, submitter info, status dropdown)
- Bulk status changes and delete
- Badge counts for new items

## Email Notifications

- Triggered on new feedback submission via Resend
- Sent to project owner's email
- v1: immediate delivery, batching/debouncing deferred

## Project Structure

```
saas-maker/
├── apps/
│   └── dashboard/                # Next.js 15, App Router
│       ├── app/
│       │   ├── login/
│       │   ├── projects/
│       │   └── api/auth/[...nextauth]/
│       ├── components/
│       └── tailwind.config.ts
├── packages/
│   ├── shared-types/             # TypeScript types
│   ├── db/                       # CockroachDB schema + migrations
│   └── feedback-widget/          # React SDK
│       ├── src/
│       │   ├── FeedbackWidget.tsx
│       │   ├── components/
│       │   └── styles/
│       └── package.json
└── workers/
    └── api/                      # Cloudflare Workers + Hono
        ├── wrangler.toml
        └── src/
            ├── index.ts
            ├── routes/
            │   ├── feedback.ts
            │   ├── projects.ts
            │   ├── upload.ts
            │   └── auth.ts
            ├── email.ts
            └── r2.ts
```

## Future (not v1)

- Public roadmap board
- Analytics (volume, top requests, sentiment)
- Status update notifications to submitters
- AI-powered feedback implementation (connect repo)
- Integration with code-reviewer
- Magic link auth for non-Google users
- npm publish of widget package
