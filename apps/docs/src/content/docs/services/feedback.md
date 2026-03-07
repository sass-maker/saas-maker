---
title: Feedback & Feature Requests
description: Collect bugs, feature requests, and feedback from your users with voting support.
---

Collect structured feedback from your users. Supports bugs, feature requests, and general feedback with upvote/downvote voting.

## Quick Start

```bash
curl -X POST https://api.sassmaker.com/v1/feedback \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_your_api_key" \
  -d '{
    "title": "Add dark mode",
    "description": "Would love a dark mode option for the dashboard",
    "type": "feature",
    "submitter_email": "user@example.com"
  }'
```

## Feedback Types

| Type | Description |
|------|-------------|
| `bug` | Something is broken |
| `feature` | A new feature request |
| `feedback` | General feedback |

## Status Workflow

All feedback types share three statuses:

| Status | Description |
|--------|-------------|
| `new` | Just submitted (default) |
| `dismissed` | Won't act on this |
| `on_roadmap` | Promoted to the [Roadmap](/services/roadmap) |

Use the "Move to Roadmap" action in the dashboard to promote feedback. This creates a roadmap item and sets the status to `on_roadmap`.

## Voting

Users can upvote or downvote entries. Vote counts (`upvote_count`, `downvote_count`) are returned with each feedback entry, helping you prioritize what to build.

## Public Board

Every project gets a public feedback board at:

```
https://app.sassmaker.com/f/[project-slug]
```

Users can browse and vote on existing feedback without needing an API key.

## API Endpoints

### Submit feedback

```
POST /v1/feedback
```

**Auth:** API Key

```bash
curl -X POST https://api.sassmaker.com/v1/feedback \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_your_api_key" \
  -d '{
    "title": "Add dark mode",
    "description": "Would love a dark mode option",
    "type": "feature",
    "submitter_email": "user@example.com",
    "submitter_name": "Jane Doe"
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Short summary |
| `description` | string | Yes | Detailed description |
| `type` | string | Yes | `bug`, `feature`, or `feedback` |
| `submitter_email` | string | Yes | Email of the person submitting |
| `submitter_name` | string | No | Name of the person submitting |
| `image_url` | string | No | Screenshot or attachment URL |

**Response (201):**

```json
{
  "id": "abc-123",
  "project_id": "proj_456",
  "type": "feature",
  "status": "new",
  "title": "Add dark mode",
  "description": "Would love a dark mode option",
  "submitter_email": "user@example.com",
  "submitter_name": "Jane Doe",
  "image_url": null,
  "upvote_count": 0,
  "downvote_count": 0,
  "created_at": "2025-01-01T00:00:00Z"
}
```

**Errors:**

| Status | Message | Cause |
|--------|---------|-------|
| `400` | `"title is required"` | Missing title field |
| `400` | `"Invalid type"` | Type is not `bug`, `feature`, or `feedback` |

### List feedback

```
GET /v1/feedback
```

**Auth:** API Key

```bash
curl "https://api.sassmaker.com/v1/feedback?type=feature&sort=upvotes&page=1" \
  -H "X-Project-Key: pk_your_api_key"
```

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | all | Filter by `bug`, `feature`, or `feedback` |
| `status` | string | all | Filter by status |
| `sort` | string | `newest` | `newest` or `upvotes` |
| `page` | number | 1 | Page number (20 items per page) |

**Response (200):**

```json
{
  "data": [{ "id": "...", "title": "...", "upvote_count": 5, ... }],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

### List feedback by project slug (public)

```
GET /v1/feedback/by-project/:slug
```

**Auth:** None (public endpoint)

```bash
curl "https://api.sassmaker.com/v1/feedback/by-project/my-app?sort=upvotes"
```

Same query params as above. Response includes project info:

```json
{
  "data": [...],
  "total": 42,
  "page": 1,
  "limit": 20,
  "project": { "name": "My App", "slug": "my-app" }
}
```

**Errors:**

| Status | Message | Cause |
|--------|---------|-------|
| `404` | `"Project not found"` | Invalid slug |

### Upvote / Downvote

```
POST /v1/feedback/:id/upvote
POST /v1/feedback/:id/downvote
DELETE /v1/feedback/:id/upvote
DELETE /v1/feedback/:id/downvote
```

**Auth:** Session Token

POST adds a vote, DELETE removes it. Each user can have one vote per feedback entry.

**Response (200):** `{ "ok": true }`

### Update status

```
PATCH /v1/feedback/:id
```

**Auth:** Session Token (project owner only)

```bash
curl -X PATCH https://api.sassmaker.com/v1/feedback/abc-123 \
  -H "Authorization: Bearer SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "dismissed" }'
```

**Errors:**

| Status | Message | Cause |
|--------|---------|-------|
| `400` | `"Invalid status"` | Status not `new`, `dismissed`, or `on_roadmap` |
| `403` | `"Forbidden"` | Not the project owner |
| `404` | `"Not found"` | Feedback entry doesn't exist |

### Delete feedback

```
DELETE /v1/feedback/:id
```

**Auth:** Session Token (project owner only)

**Response (200):** `{ "ok": true }`

## SDK Usage

```typescript
import { SaaSMakerClient } from '@saas-maker/sdk';

const client = new SaaSMakerClient({ apiKey: 'pk_your_api_key' });

// Submit feedback
await client.feedback.submit({
  title: 'Add dark mode',
  description: 'Would love a dark mode option',
  type: 'feature',
  submitter_email: 'user@example.com',
});

// List feedback
const { data, total } = await client.feedback.list({
  type: 'feature',
  sort: 'upvotes',
});
```
