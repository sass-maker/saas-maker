---
title: Directory
description: Public product directory with submissions, badge verification, and tag filtering.
---

A public directory of products built with SaasMaker. Users can browse approved listings, filter by tag, search, and submit their own products for review.

## Quick Start

Fetch approved directory listings:

```bash
curl https://api.sassmaker.com/v1/directory
```

## How it works

1. A user submits their product via the public form or the API
2. Submissions start with `pending` status
3. Once approved, the listing appears in the public directory
4. Projects can optionally verify badge placement on their site for a "verified" checkmark

## API Endpoints

### List approved listings

```
GET /v1/directory
```

**Auth:** None (public endpoint)

Returns paginated approved listings with optional tag and search filters.

```bash
curl "https://api.sassmaker.com/v1/directory?page=1&tag=saas&search=analytics"
```

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | `1` | Page number |
| `tag` | string | — | Filter by tag (e.g. `saas`, `ai`, `devtools`) |
| `search` | string | — | Search by name or tagline (case-insensitive) |

**Response (200):**

```json
{
  "data": [
    {
      "id": "abc-123",
      "name": "Acme Analytics",
      "tagline": "Real-time analytics for indie hackers",
      "url": "https://acme.com",
      "description": null,
      "logo_url": "https://acme.com/logo.png",
      "screenshot_url": null,
      "twitter_url": null,
      "project_id": null,
      "badge_verified": false,
      "status": "approved",
      "tags": ["analytics", "saas"],
      "created_at": "2026-03-01T00:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 24
}
```

### Submit a listing

```
POST /v1/directory
```

**Auth:** None (public endpoint)

Submit a product for review. Listings start as `pending`.

```bash
curl -X POST https://api.sassmaker.com/v1/directory \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme",
    "tagline": "The fastest way to ship SaaS",
    "url": "https://acme.com",
    "tags": ["saas", "devtools"]
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Product name |
| `tagline` | string | Yes | Short description (max 120 chars) |
| `url` | string | Yes | Product URL (must start with `http://` or `https://`) |
| `description` | string | No | Longer description |
| `logo_url` | string | No | URL to product logo |
| `screenshot_url` | string | No | URL to product screenshot |
| `twitter_url` | string | No | Twitter/X profile URL |
| `tags` | string[] | No | Up to 5 tags (lowercased automatically) |

**Response (201):** Full listing object.

**Errors:**

| Status | Message | Cause |
|--------|---------|-------|
| `400` | `"name is required"` | Missing name |
| `400` | `"tagline is required"` | Missing tagline |
| `400` | `"url is required"` | Missing URL |
| `400` | `"Invalid URL"` | URL doesn't match `https?://` pattern |
| `400` | `"tagline must be 120 characters or fewer"` | Tagline too long |

### Claim a listing (project-linked)

```
POST /v1/directory/claim
```

**Auth:** API Key

Submit a listing linked to your project. This enables badge verification. Each project can have at most one directory listing.

```bash
curl -X POST https://api.sassmaker.com/v1/directory/claim \
  -H "X-Project-Key: pk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme",
    "tagline": "The fastest way to ship SaaS",
    "url": "https://acme.com"
  }'
```

**Response (201):** Full listing object with `project_id` set.

**Errors:**

| Status | Message | Cause |
|--------|---------|-------|
| `409` | `"Project already has a directory listing"` | Project already claimed a listing |

### Verify badge

```
POST /v1/directory/verify-badge
```

**Auth:** API Key

Checks whether the "Built with SaasMaker" badge is present on the listing's URL. If found, the listing's `badge_verified` flag is set to `true`.

```bash
curl -X POST https://api.sassmaker.com/v1/directory/verify-badge \
  -H "X-Project-Key: pk_your_api_key"
```

The endpoint fetches the listing URL and searches the HTML for a link containing `sassmaker.com/made-with`.

**Response (200):**

```json
{
  "verified": true,
  "listing_id": "abc-123"
}
```

**Errors:**

| Status | Message | Cause |
|--------|---------|-------|
| `404` | `"No directory listing found for this project"` | Project has no listing — call `/claim` first |
| `422` | `"Could not reach the URL"` | URL is unreachable or timed out (8s limit) |

## Badge Widget

Add the "Built with SaasMaker" badge to your site to get verified. See the [Badge Widget docs](/widgets/badge/) for React and HTML options.

## SDK Usage

```typescript
// Submit a listing
const listing = await client.directory.submit({
  name: 'Acme',
  tagline: 'The fastest way to ship SaaS',
  url: 'https://acme.com',
  tags: ['saas'],
});
```
