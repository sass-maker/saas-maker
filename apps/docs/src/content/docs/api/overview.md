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
| Analytics | `/v1/analytics` | [Analytics](/services/analytics) |
| Standards | `/v1/standards` | Fleet standards (CLI-driven) |
| Tasks | `/v1/tasks` | Cockpit tasks |
| Jobs | `/v1/jobs` | Cockpit jobs |
| Secrets | `/v1/secrets` | Project secrets |
| Auth | `/v1/auth` / `/v1/cli` | Sessions and CLI auth |
