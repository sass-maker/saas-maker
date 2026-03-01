---
title: Waitlist
description: Collect pre-launch signups and automatically send welcome emails.
---

Build a waitlist for your product before launch. When someone joins, SaaS Maker automatically sends a welcome email via Resend.

## How it works

1. Add the waitlist endpoint or widget to your landing page
2. Users submit their email (and optionally their name and referral source)
3. A welcome email is sent automatically
4. View and manage entries in the dashboard

## API endpoints

### Join waitlist

```
POST /v1/waitlist
```

**Auth:** API Key

```bash
curl -X POST https://api.sassmaker.com/v1/waitlist \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_abc123" \
  -d '{
    "email": "user@example.com",
    "name": "Jane Doe",
    "referral_source": "twitter"
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Email address |
| `name` | string | No | Full name |
| `referral_source` | string | No | How they found you |

### List waitlist entries

```
GET /v1/waitlist?project_id=...
```

**Auth:** Session Token

```bash
curl https://api.sassmaker.com/v1/waitlist?project_id=proj_123 \
  -H "Authorization: Bearer <token>"
```

Returns all waitlist entries for the project, sorted by signup date.
