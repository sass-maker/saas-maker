---
title: Changelog
description: Publish product updates and keep your users informed.
---

Keep your users informed about product updates. Create changelog entries with categories, and publish them when ready.

## Entry types

- `feature` — new functionality
- `improvement` — enhancement to existing features
- `fix` — bug fix
- `breaking` — breaking change

## Draft support

Entries can be saved as drafts and published later. Only published entries are visible to users via the public API or widgets.

## API endpoints

### List published entries

```
GET /v1/changelog
```

**Auth:** API Key

```bash
curl https://api.sassmaker.com/v1/changelog \
  -H "X-Project-Key: pk_abc123"
```

Returns published changelog entries sorted by date (newest first).

### Create entry

```
POST /v1/changelog/dashboard/:projectId
```

**Auth:** Session Token

```bash
curl -X POST https://api.sassmaker.com/v1/changelog/dashboard/proj_123 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Dark mode support",
    "content": "You can now switch to dark mode in Settings.",
    "type": "feature",
    "published": true
  }'
```

### Update entry

```
PATCH /v1/changelog/dashboard/:projectId/:id
```

**Auth:** Session Token

```bash
curl -X PATCH https://api.sassmaker.com/v1/changelog/dashboard/proj_123/456 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "published": true }'
```

### Delete entry

```
DELETE /v1/changelog/dashboard/:projectId/:id
```

**Auth:** Session Token
