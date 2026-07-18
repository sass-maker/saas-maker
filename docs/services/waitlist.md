---
title: "Waitlist"
description: "Collect pre-launch signups with automatic position tracking."
---

Build a waitlist for your product. Users sign up with their email, get assigned a position, and you can manage entries from the dashboard.

## Quick Start

```bash
curl -X POST https://api.sassmaker.com/v1/waitlist \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_your_api_key" \
  -d '{
    "email": "user@example.com",
    "name": "Jane Doe"
  }'
```

## API Endpoints

### Join waitlist

```
POST /v1/waitlist
```

**Auth:** API Key

```bash
curl -X POST https://api.sassmaker.com/v1/waitlist \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_your_api_key" \
  -d '{
    "email": "user@example.com",
    "name": "Jane Doe"
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Email address |
| `name` | string | No | Full name |

**Response (201):**

```json
{
  "id": "abc-123",
  "email": "user@example.com",
  "name": "Jane Doe",
  "position": 42,
  "created_at": "2025-01-01T00:00:00Z"
}
```

**Errors:**

| Status | Message | Cause |
|--------|---------|-------|
| `400` | `"email is required"` | Missing or invalid email |
| `409` | `"Email already on waitlist"` | Duplicate signup |

### Get waitlist count

```
GET /v1/waitlist/count
```

**Auth:** API Key

```bash
curl https://api.sassmaker.com/v1/waitlist/count \
  -H "X-Project-Key: pk_your_api_key"
```

**Response (200):**

```json
{ "count": 142 }
```

Use this to display "142 people on the waitlist" on your landing page.

### List waitlist entries

```
GET /v1/waitlist?project_id=PROJECT_ID&page=1
```

**Auth:** Session Token

```bash
curl "https://api.sassmaker.com/v1/waitlist?project_id=proj_123&page=1" \
  -H "Authorization: Bearer SESSION_TOKEN"
```

**Response (200):**

```json
{
  "data": [
    { "id": "abc-123", "email": "user@example.com", "name": "Jane Doe", "position": 1, "created_at": "..." }
  ],
  "total": 142,
  "page": 1,
  "limit": 50
}
```

**Errors:**

| Status | Message | Cause |
|--------|---------|-------|
| `400` | `"project_id is required"` | Missing project_id query param |
| `403` | `"Forbidden"` | Not the project owner |

### Delete waitlist entry

```
DELETE /v1/waitlist/:id?project_id=PROJECT_ID
```

**Auth:** Session Token

**Response (200):** `{ "ok": true }`

**Errors:**

| Status | Message | Cause |
|--------|---------|-------|
| `403` | `"Forbidden"` | Not the project owner |
| `404` | `"Not found"` | Entry doesn't exist |

## SDK Usage

```typescript
import { SaaSMakerClient } from '@saas-maker/sdk';

const client = new SaaSMakerClient({ apiKey: 'pk_your_api_key' });

// Add to waitlist
const entry = await client.waitlist.join({
  email: 'user@example.com',
  name: 'Jane Doe',
});
console.log(`Position: ${entry.position}`);

// Get count
const { count } = await client.waitlist.count();
```
