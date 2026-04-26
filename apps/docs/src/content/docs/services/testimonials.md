---
title: Testimonials
description: Collect, moderate, and display customer testimonials.
---

Collect testimonials from your customers and display approved ones on your site. Submissions start as `pending` and can be approved or rejected in the dashboard.

## Quick Start

```bash
curl -X POST https://api.sassmaker.com/v1/testimonials \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_your_api_key" \
  -d '{
    "author_name": "Jane Doe",
    "author_email": "jane@example.com",
    "content": "Foundry saved us weeks of development time.",
    "rating": 5
  }'
```

## Status Workflow

`pending` → `approved` / `rejected`

New submissions are always `pending`. Approve or reject from the dashboard or API.

## Public Submission Page

Every project gets a public testimonial submission page at:

```
https://app.sassmaker.com/t/[project-slug]
```

Share this in email campaigns, onboarding flows, or support follow-ups.

## API Endpoints

### Submit testimonial

```
POST /v1/testimonials
```

**Auth:** API Key

```bash
curl -X POST https://api.sassmaker.com/v1/testimonials \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_your_api_key" \
  -d '{
    "author_name": "Jane Doe",
    "author_email": "jane@example.com",
    "content": "Foundry saved us weeks of development time.",
    "rating": 5,
    "author_title": "CTO at Acme",
    "tweet_url": "https://twitter.com/jane/status/123"
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `author_name` | string | Yes | Name of the person |
| `author_email` | string | Yes | Email address |
| `content` | string | Yes | Testimonial text |
| `rating` | number | Yes | Rating from 1 to 5 |
| `author_title` | string | No | Job title or role |
| `author_avatar_url` | string | No | Avatar image URL |
| `image_url` | string | No | Attached image URL |
| `tweet_url` | string | No | Link to original tweet |

**Response (201):**

```json
{
  "id": "abc-123",
  "status": "pending",
  "created_at": "2025-01-01T00:00:00Z"
}
```

**Errors:**

| Status | Message | Cause |
|--------|---------|-------|
| `400` | `"author_name is required"` | Missing required field |
| `400` | `"Invalid email"` | Malformed email address |
| `400` | `"rating must be between 1 and 5"` | Invalid rating |

### Submit by project slug (public)

```
POST /v1/testimonials/by-project/:slug
```

**Auth:** None (public)

Same body as above. Use this for public forms where no API key is available.

**Errors:**

| Status | Message | Cause |
|--------|---------|-------|
| `404` | `"Project not found"` | Invalid slug |

### Get project info by slug (public)

```
GET /v1/testimonials/by-project/:slug
```

**Auth:** None (public)

Returns project name and slug for rendering the submission form.

### List approved testimonials

```
GET /v1/testimonials?limit=50&sort=newest
```

**Auth:** API Key

```bash
curl "https://api.sassmaker.com/v1/testimonials?sort=rating&limit=10" \
  -H "X-Project-Key: pk_your_api_key"
```

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 50 | Max testimonials to return |
| `sort` | string | `newest` | `newest` or `rating` |

**Response (200):**

```json
{
  "data": [
    {
      "id": "abc-123",
      "author_name": "Jane Doe",
      "author_title": "CTO at Acme",
      "content": "Foundry saved us weeks...",
      "rating": 5,
      "status": "approved",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

Only returns `approved` testimonials. Use this to display on your site.

### List all testimonials (dashboard)

```
GET /v1/testimonials/all?project_id=PROJECT_ID&page=1
```

**Auth:** Session Token

Returns all testimonials (pending, approved, rejected) with stats.

**Response (200):**

```json
{
  "data": [...],
  "total": 25,
  "page": 1,
  "limit": 50,
  "stats": {
    "total": 25,
    "pending": 3,
    "approved": 20,
    "avg_rating": 4.6
  }
}
```

### Update status (approve/reject)

```
PATCH /v1/testimonials/:id?project_id=PROJECT_ID
```

**Auth:** Session Token

```bash
curl -X PATCH "https://api.sassmaker.com/v1/testimonials/abc-123?project_id=proj_456" \
  -H "Authorization: Bearer SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "approved" }'
```

Valid statuses: `pending`, `approved`, `rejected`.

**Errors:**

| Status | Message | Cause |
|--------|---------|-------|
| `400` | `"Invalid status"` | Not a valid status value |
| `403` | `"Forbidden"` | Not the project owner |
| `404` | `"Not found"` | Testimonial doesn't exist |

### Delete testimonial

```
DELETE /v1/testimonials/:id?project_id=PROJECT_ID
```

**Auth:** Session Token

**Response (200):** `{ "ok": true }`

## SDK Usage

```typescript
import { SaaSMakerClient } from '@saas-maker/sdk';

const client = new SaaSMakerClient({ apiKey: 'pk_your_api_key' });

// Submit a testimonial
await client.testimonials.submit({
  author_name: 'Jane Doe',
  author_email: 'jane@example.com',
  content: 'Amazing product!',
  rating: 5,
});

// List approved testimonials
const { data } = await client.testimonials.list({ sort: 'rating' });
```
