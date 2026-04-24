---
title: Changelog
description: Publish product updates and keep your users informed.
---

Keep your users informed about product updates. Create changelog entries with categories, save as drafts, and publish when ready.

## Quick Start

Fetch published entries (for displaying on your site):

```bash
curl https://api.sassmaker.com/v1/changelog \
  -H "X-Project-Key: pk_your_api_key"
```

## Entry Types

| Type | Description |
|------|-------------|
| `feature` | New functionality |
| `improvement` | Enhancement to existing features |
| `fix` | Bug fix |
| `breaking` | Breaking change |

## Draft Support

Entries can be saved as drafts (`published: false`) and published later. Only published entries are visible via the public API or widgets.

## API Endpoints

### List published entries

```
GET /v1/changelog?limit=50
```

**Auth:** API Key

```bash
curl "https://api.sassmaker.com/v1/changelog?limit=10" \
  -H "X-Project-Key: pk_your_api_key"
```

**Response (200):**

```json
{
  "data": [
    {
      "id": "abc-123",
      "title": "Dark mode support",
      "content": "You can now switch to dark mode in Settings.",
      "version": "1.2.0",
      "type": "feature",
      "published": true,
      "published_at": "2025-01-15T00:00:00Z",
      "created_at": "2025-01-14T00:00:00Z",
      "updated_at": "2025-01-15T00:00:00Z"
    }
  ]
}
```

Returns only published entries, sorted by date (newest first). Use this to display changelogs on your site.

### List all entries (dashboard)

```
GET /v1/changelog/dashboard/:projectId?page=1
```

**Auth:** Session Token

Returns all entries (drafts + published) with stats.

**Response (200):**

```json
{
  "data": [...],
  "total": 15,
  "page": 1,
  "limit": 50,
  "stats": {
    "total": 15,
    "published": 12,
    "drafts": 3
  }
}
```

### Create entry

```
POST /v1/changelog/dashboard/:projectId
```

**Auth:** Session Token

```bash
curl -X POST https://api.sassmaker.com/v1/changelog/dashboard/proj_123 \
  -H "Authorization: Bearer SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Dark mode support",
    "content": "You can now switch to dark mode in Settings.",
    "type": "feature",
    "version": "1.2.0",
    "published": true
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Entry title |
| `content` | string | Yes | Entry body (supports markdown) |
| `type` | string | No | `feature`, `improvement`, `fix`, or `breaking` (default: `improvement`) |
| `version` | string | No | Version tag (e.g. `1.2.0`) |
| `published` | boolean | No | Publish immediately (default: false = draft) |

**Response (201):** Full changelog entry object.

**Errors:**

| Status | Message | Cause |
|--------|---------|-------|
| `400` | `"title is required"` | Missing title |
| `400` | `"content is required"` | Missing content |
| `400` | `"Invalid type"` | Type not one of the valid values |
| `403` | `"Forbidden"` | Not the project owner |

### Update entry

```
PATCH /v1/changelog/dashboard/:projectId/:id
```

**Auth:** Session Token

```bash
curl -X PATCH https://api.sassmaker.com/v1/changelog/dashboard/proj_123/abc-123 \
  -H "Authorization: Bearer SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "published": true }'
```

All fields are optional. Setting `published: true` automatically sets `published_at`.

**Errors:**

| Status | Message | Cause |
|--------|---------|-------|
| `403` | `"Forbidden"` | Not the project owner |
| `404` | `"Not found"` | Entry doesn't exist |

### Delete entry

```
DELETE /v1/changelog/dashboard/:projectId/:id
```

**Auth:** Session Token

**Response (200):** `{ "ok": true }`

## SDK Usage

```typescript
import { SaaSMakerClient } from '@foundry/sdk';

const client = new SaaSMakerClient({ apiKey: 'pk_your_api_key' });

// List published entries
const { data } = await client.changelog.list({ limit: 10 });
```
