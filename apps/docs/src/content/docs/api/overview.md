---
title: API Overview
description: Base URL, authentication, error format, and general conventions for the Foundry REST API.
---

## Base URL

```
https://api.sassmaker.com
```

All endpoints are prefixed with `/v1/`.

## Authentication

Two methods are supported. See [Authentication](/getting-started/authentication) for details.

| Method | Header | Use case |
|--------|--------|----------|
| API Key | `X-Project-Key: pk_...` | SDK, widgets, public endpoints |
| Session Token | `Authorization: Bearer <token>` | Dashboard, CLI, admin operations |

## Request format

All request bodies must be JSON with `Content-Type: application/json`.

## Response format

All responses return JSON. Successful responses return the resource or a list:

```json
{ "data": [...], "total": 42, "page": 1, "limit": 20 }
```

Or for single-resource operations:

```json
{ "ok": true }
```

## Error format

Errors return a JSON object with an `error` field and an appropriate HTTP status code:

```json
{ "error": "Title is required" }
```

Common status codes:

| Code | Meaning |
|------|---------|
| `400` | Bad request (missing or invalid fields) |
| `403` | Forbidden (not the project owner) |
| `404` | Resource not found |
| `409` | Conflict (duplicate entry) |
| `413` | Payload too large |

## CORS

The API allows cross-origin requests from any origin. Widgets and browser-based SDK calls work without proxy configuration.

## Health check

```
GET /health
```

Returns `{ "ok": true }` if the API is running. No authentication required.

## Rate limits

The API runs on Cloudflare Workers with no hard rate limits currently enforced. Abuse may result in throttling.

## Endpoints by service

| Service | Prefix | Docs |
|---------|--------|------|
| Feedback | `/v1/feedback` | [Feedback](/services/feedback) |
| Waitlist | `/v1/waitlist` | [Waitlist](/services/waitlist) |
| Testimonials | `/v1/testimonials` | [Testimonials](/services/testimonials) |
| Changelog | `/v1/changelog` | [Changelog](/services/changelog) |
| Knowledge Base | `/v1/indexes` | [Knowledge Base](/services/knowledge-base) |
| Analytics | `/v1/analytics` | [Analytics](/services/analytics) |
| AI Gateway | `/v1/ai` | [AI Gateway](/services/ai-gateway) |
