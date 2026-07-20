---
title: "API Overview"
description: "Base URL, authentication, error format, and general conventions for the Foundry REST API."
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

All responses return JSON. List endpoints return a paginated envelope:

```json
{ "data": [...], "total": 42, "page": 1, "limit": 20 }
```

Single-resource creates and updates return the full record; mutations without a body return `{ "ok": true }`.

### Pagination

List endpoints accept `page` (1-indexed) and, where supported, `limit`. Defaults are `page=1` and a per-endpoint `limit` (typically `20`–`50`). `total` is always returned so clients can compute the last page.

## Error format

Errors return a JSON object with an `error` field and an appropriate HTTP status code:

```json
{ "error": "title is required" }
```

| Code | Meaning |
|------|---------|
| `400` | Bad request (missing or invalid fields) |
| `401` | Unauthenticated (missing or invalid token / key) |
| `403` | Forbidden (authenticated, but not the project owner) |
| `404` | Resource not found |
| `409` | Conflict (duplicate entry) |
| `413` | Payload too large |
| `429` | Rate-limited — see below |

## Rate limiting

Per-project rate limits are enforced on public endpoints. The default is configurable per project (`rate_limit_rpm` on the project record) and limits are reported back via standard headers when a request is throttled. When you hit the limit you'll get `429` with `{ "error": "Rate limit exceeded" }` — back off and retry.

## CORS

The API allows cross-origin requests from a fleet allowlist (sassmaker.com, app.sassmaker.com, *.pages.dev, *.workers.dev, localhost). Other origins fall back to `https://app.sassmaker.com`.

## Health check

```
GET /health
```

Returns `{ "status": "ok" }` if the API is running. No authentication required.

## Endpoints by service

| Service | Prefix | Docs |
|---------|--------|------|
| Projects | `/v1/projects` | [Projects](/services/projects) |
| Feedback | `/v1/feedback` | [Feedback](/services/feedback) |
| Roadmap | `/v1/roadmap` | [Roadmap](/services/roadmap) |
| Waitlist | `/v1/waitlist` | [Waitlist](/services/waitlist) |
| Testimonials | `/v1/testimonials` | [Testimonials](/services/testimonials) |
| Changelog | `/v1/changelog` | [Changelog](/services/changelog) |
| Standards | `/v1/standards` | Fleet standards (CLI-driven) |
| Tasks | `/v1/tasks` | Cockpit tasks |
| Jobs | `/v1/jobs` | Cockpit jobs |
| Performance | `/v1/performance` | Private speed summaries, recent sampled requests, route percentiles, traces, retention, and project-scoped receipt ingestion |
| Auth | `/v1/auth` / `/v1/cli` | Sessions and CLI auth |
