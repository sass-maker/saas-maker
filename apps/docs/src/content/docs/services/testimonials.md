---
title: Testimonials
description: Collect, moderate, and display customer testimonials.
---

Collect testimonials from your customers and display approved ones on your site. Submissions start as `pending` and can be approved or rejected in the dashboard.

## Public submission page

Every project gets a public testimonial submission page at:

```
https://app.sassmaker.com/t/[project-slug]
```

Share this link in email campaigns, onboarding flows, or support follow-ups to collect testimonials effortlessly.

## API endpoints

### Submit testimonial (with API key)

```
POST /v1/testimonials
```

**Auth:** API Key

```bash
curl -X POST https://api.sassmaker.com/v1/testimonials \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_abc123" \
  -d '{
    "author_name": "Jane Doe",
    "author_email": "jane@example.com",
    "content": "SaaS Maker saved us weeks of development time.",
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
| `tweet_url` | string | No | Link to a tweet |

### Submit testimonial by slug (public)

```
POST /v1/testimonials/by-project/:slug
```

**Auth:** None (public)

Same body as above. Use this for public submission forms where no API key is available.

### List approved testimonials

```
GET /v1/testimonials
```

**Auth:** API Key

Returns only approved testimonials. Use this to display testimonials on your site.

### List all testimonials with stats

```
GET /v1/testimonials/all?project_id=...
```

**Auth:** Session Token

Returns all testimonials (pending, approved, rejected) with aggregate stats. Used by the dashboard.

### Update testimonial status

```
PATCH /v1/testimonials/:id?project_id=...
```

**Auth:** Session Token

```bash
curl -X PATCH "https://api.sassmaker.com/v1/testimonials/456?project_id=proj_123" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "status": "approved" }'
```

### Delete testimonial

```
DELETE /v1/testimonials/:id?project_id=...
```

**Auth:** Session Token
