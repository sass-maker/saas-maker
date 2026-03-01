---
title: Feedback & Feature Requests
description: Collect bugs, feature requests, and feedback from your users with voting support.
---

Collect structured feedback from your users. Supports bugs, feature requests, and general feedback with upvote/downvote voting on feature requests.

## Feedback types

- `bug` — something is broken
- `feature` — a new feature request
- `feedback` — general feedback

## Status workflow

**Bugs and feedback:**
`new` → `in_progress` → `done` / `dismissed`

**Feature requests:**
`planned` → `in_progress` → `shipped` / `cancelled`

## Voting

Users can upvote or downvote feature requests. Vote counts are returned with each feedback entry, helping you prioritize what to build next.

## Public board

Every project gets a public feedback board at:

```
https://saasmaker.vercel.app/f/[project-slug]
```

Share this link with your users so they can browse and vote on existing feedback.

## API endpoints

### Submit feedback

```
POST /v1/feedback
```

**Auth:** API Key

```bash
curl -X POST https://saasmaker-api.sarthakagrawal927.workers.dev/v1/feedback \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_abc123" \
  -d '{
    "title": "Add dark mode",
    "description": "Would love a dark mode option",
    "type": "feature",
    "submitter_email": "user@example.com"
  }'
```

### List feedback by project slug

```
GET /v1/feedback/by-project/:slug
```

**Auth:** None (public)

```bash
curl https://saasmaker-api.sarthakagrawal927.workers.dev/v1/feedback/by-project/my-app
```

### Upvote

```
POST /v1/feedback/:id/upvote
```

**Auth:** Session Token

### Downvote

```
POST /v1/feedback/:id/downvote
```

**Auth:** Session Token

### Update status

```
PATCH /v1/feedback/:id
```

**Auth:** Session Token (project owner only)

```bash
curl -X PATCH https://saasmaker-api.sarthakagrawal927.workers.dev/v1/feedback/123 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "status": "in_progress" }'
```

### Delete feedback

```
DELETE /v1/feedback/:id
```

**Auth:** Session Token (project owner only)
