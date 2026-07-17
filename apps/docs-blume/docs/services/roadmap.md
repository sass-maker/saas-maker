---
title: "Roadmap"
description: "Public product roadmap with Kanban columns, voting, and feedback promotion."
---

Share what you're building with your users. The roadmap is a public Kanban board with four fixed columns, upvoting, and the ability to promote feedback items directly onto the board.

## Quick Start

Fetch the public roadmap for a project:

```bash
curl https://api.sassmaker.com/v1/roadmap/public/my-app
```

## Columns

| Column | Description |
|--------|-------------|
| `backlog` | Ideas and tasks not yet scheduled |
| `planned` | Committed to building |
| `in_progress` | Currently being worked on |
| `done` | Shipped |

## Visibility

Each roadmap item has a `public` flag. Private items (`public: false`) are only visible to the project owner in the dashboard. The public roadmap page and API only return public items.

## Feedback Promotion

Feedback items can be promoted to roadmap items via the dashboard or the API. When promoted, the feedback status is automatically set to `on_roadmap` and a new roadmap item is created in the `planned` column with the feedback's title and description.

## Public Roadmap Page

Every project gets a public roadmap at:

```
https://app.sassmaker.com/roadmap/[project-slug]
```

Users can browse the board and upvote items without needing an API key.

## API Endpoints

### List public roadmap items

```
GET /v1/roadmap/public/:slug
```

**Auth:** None (public endpoint)

```bash
curl https://api.sassmaker.com/v1/roadmap/public/my-app
```

**Response (200):**

```json
{
  "data": [
    {
      "id": "abc-123",
      "project_id": "proj_456",
      "feedback_id": null,
      "title": "Add dark mode",
      "description": "Theme support for dark mode",
      "column": "planned",
      "position": 0,
      "public": true,
      "upvote_count": 12,
      "downvote_count": 0,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ],
  "project": { "name": "My App", "slug": "my-app" }
}
```

**Errors:**

| Status | Message | Cause |
|--------|---------|-------|
| `404` | `"Project not found"` | Invalid slug |

### Vote on a roadmap item

```
POST /v1/roadmap/public/:slug/:id/vote
```

**Auth:** None (public endpoint)

```bash
curl -X POST https://api.sassmaker.com/v1/roadmap/public/my-app/abc-123/vote \
  -H "Content-Type: application/json" \
  -d '{ "user_identifier": "user_fingerprint", "vote": 1 }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_identifier` | string | Yes | Unique identifier for the voter (e.g. localStorage UUID) |
| `vote` | number | Yes | `1` for upvote, `-1` for downvote |

**Response (200):** `{ "ok": true }`

**Errors:**

| Status | Message | Cause |
|--------|---------|-------|
| `400` | `"user_identifier is required"` | Missing user_identifier |
| `400` | `"vote must be 1 or -1"` | Invalid vote value |
| `404` | `"Item not found"` | Item doesn't exist or is private |

### Remove vote

```
DELETE /v1/roadmap/public/:slug/:id/vote?user_identifier=...
```

**Auth:** None (public endpoint)

**Response (200):** `{ "ok": true }`

### Create roadmap item (dashboard)

```
POST /v1/roadmap/dashboard/:projectId
```

**Auth:** Session Token (project owner only)

```bash
curl -X POST https://api.sassmaker.com/v1/roadmap/dashboard/proj_456 \
  -H "Authorization: Bearer SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Add dark mode",
    "description": "Theme support",
    "column": "backlog",
    "public": true
  }'
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `title` | string | Yes | — | Item title |
| `description` | string | No | `null` | Item description |
| `column` | string | No | `backlog` | `backlog`, `planned`, `in_progress`, or `done` |
| `public` | boolean | No | `true` | Visible on public roadmap |

**Response (201):** Full roadmap item object.

**Errors:**

| Status | Message | Cause |
|--------|---------|-------|
| `400` | `"Title is required"` | Missing title |
| `400` | `"Invalid column"` | Column not one of the four valid values |
| `403` | `"Forbidden"` | Not the project owner |

### Promote feedback to roadmap

```
POST /v1/roadmap/dashboard/:projectId/from-feedback/:feedbackId
```

**Auth:** Session Token (project owner only)

Creates a roadmap item from a feedback entry. The item is placed in the `planned` column and the feedback status is set to `on_roadmap`.

**Response (201):** Full roadmap item object with `feedback_id` set.

**Errors:**

| Status | Message | Cause |
|--------|---------|-------|
| `403` | `"Forbidden"` | Not the project owner |
| `404` | `"Feedback not found"` | Invalid feedback ID or wrong project |

### Update roadmap item

```
PATCH /v1/roadmap/dashboard/:projectId/:id
```

**Auth:** Session Token (project owner only)

```bash
curl -X PATCH https://api.sassmaker.com/v1/roadmap/dashboard/proj_456/abc-123 \
  -H "Authorization: Bearer SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "column": "in_progress" }'
```

All fields are optional: `title`, `description`, `column`, `position`, `public`.

**Response (200):** Updated roadmap item object.

### Delete roadmap item

```
DELETE /v1/roadmap/dashboard/:projectId/:id
```

**Auth:** Session Token (project owner only)

**Response (200):** `{ "ok": true }`

### Batch reorder

```
POST /v1/roadmap/dashboard/:projectId/reorder
```

**Auth:** Session Token (project owner only)

Used after drag-and-drop to persist new positions.

```bash
curl -X POST https://api.sassmaker.com/v1/roadmap/dashboard/proj_456/reorder \
  -H "Authorization: Bearer SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "id": "abc-123", "column": "in_progress", "position": 0 },
      { "id": "def-456", "column": "in_progress", "position": 1 }
    ]
  }'
```

**Response (200):** `{ "ok": true }`
