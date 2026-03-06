# AI Gateway Dashboard Page

## What
Add `/projects/[slug]/ai` page to the SaaS Maker dashboard with config, usage stats, and request logs.

## Tasks

### 1. Add sidebar nav entry
- Add "AI Gateway" item with `Zap` icon between "Knowledge Base" and "Forms" in `sidebar-nav.tsx`

### 2. Create page shell
- `apps/dashboard/src/app/projects/[slug]/ai/page.tsx` — server component, same pattern as analytics page
- `apps/dashboard/src/app/projects/[slug]/ai/ai-content.tsx` — client component with tabs

### 3. Overview tab
- Stat cards: Total Requests, Success Rate, Avg Latency, Total Tokens
- Fetches from `GET /v1/ai/usage/:projectId`
- Integration snippet section (chat, embeddings, RAG)

### 4. Logs tab
- Table: timestamp, endpoint, model, status, latency, input/output tokens
- Fetches from `GET /v1/ai/requests/:projectId`
- Pagination with limit/offset

### 5. Config tab
- Show current config (provider URL, masked key, model) from `GET /v1/ai/config/:projectId`
- Form to update via `PUT /v1/ai/config/:projectId`
- Delete config via `DELETE /v1/ai/config/:projectId`
- "Using free tier" badge when no custom config

## API endpoints (all exist)
- `GET /v1/ai/config/:projectId` — requires session
- `PUT /v1/ai/config/:projectId` — requires session
- `DELETE /v1/ai/config/:projectId` — requires session
- `GET /v1/ai/usage/:projectId` — requires session
- `GET /v1/ai/requests/:projectId` — requires session
