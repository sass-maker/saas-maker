---
title: AI Mention Check
description: Track how often LLMs mention your product across saved prompts and providers.
---

AI Mention Check runs the same prompt set against multiple model providers, stores the raw responses, and summarizes how often your brand appears, where it ranks, and whether it gets cited.

## What It Tracks

- Brand mention rate across recent checks
- Position in ranked lists when your brand appears
- Basic sentiment around the mention
- Competitor mentions in the same response
- Citations back to your site

## Auth Model

All `ai-mention` endpoints are **session-authenticated** dashboard routes. Use:

- `Authorization: Bearer sm_...` for CLI tokens
- `Authorization: Bearer <dashboard-session-token>` for dashboard-backed calls

These routes do **not** accept `X-Project-Key` because the config can contain provider API keys.

## Endpoint Summary

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/ai-mention/config/:projectId` | Get saved config |
| `POST` | `/v1/ai-mention/config/:projectId` | Create or update config |
| `DELETE` | `/v1/ai-mention/config/:projectId` | Delete config |
| `GET` | `/v1/ai-mention/prompts/:projectId` | List saved prompts |
| `POST` | `/v1/ai-mention/prompts/:projectId` | Add a prompt |
| `DELETE` | `/v1/ai-mention/prompts/:projectId/:id` | Delete a prompt |
| `POST` | `/v1/ai-mention/check/:projectId` | Start a check run |
| `GET` | `/v1/ai-mention/checks/:projectId` | List recent checks |
| `GET` | `/v1/ai-mention/checks/:projectId/:checkId` | Get one check with results |
| `GET` | `/v1/ai-mention/dashboard/:projectId` | Combined dashboard payload |

## Save Config

```
POST /v1/ai-mention/config/:projectId
```

```bash
curl -X POST https://api.sassmaker.com/v1/ai-mention/config/proj_123 \
  -H "Authorization: Bearer SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "brand_name": "Acme",
    "brand_aliases": ["Acme AI"],
    "brand_url": "https://acme.com",
    "competitors": [
      { "name": "Linear", "url": "https://linear.app" },
      { "name": "Notion", "url": "https://notion.so" }
    ],
    "platforms": ["openai", "google"],
    "openai_api_key": "sk-...",
    "google_api_key": "AIza..."
  }'
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `brand_name` | string | Yes | Primary brand name to detect |
| `brand_aliases` | string[] | No | Alternate names or spellings |
| `brand_url` | string | No | Used for citation detection |
| `competitors` | array | No | Up to 5 competitors |
| `platforms` | array | No | Any of `openai`, `anthropic`, `google`, `perplexity` |
| `openai_api_key` | string | No | Required only if using `openai` |
| `anthropic_api_key` | string | No | Required only if using `anthropic` |
| `google_api_key` | string | No | Required only if using `google` |
| `perplexity_api_key` | string | No | Required only if using `perplexity` |

**Errors**

| Status | Message | Cause |
|--------|---------|-------|
| `400` | `"brand_name is required"` | Missing or empty brand name |
| `400` | `"Max 5 competitors"` | Too many competitors |
| `400` | `"Invalid platform"` | Platform not in allowlist |
| `403` | `"Forbidden"` | User does not own the project |

## Add a Prompt

```
POST /v1/ai-mention/prompts/:projectId
```

```bash
curl -X POST https://api.sassmaker.com/v1/ai-mention/prompts/proj_123 \
  -H "Authorization: Bearer SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "prompt_text": "What is the best AI customer support tool?", "category": "support" }'
```

Each project can store up to `20` prompts.

## Start a Check

```
POST /v1/ai-mention/check/:projectId
```

```bash
curl -X POST https://api.sassmaker.com/v1/ai-mention/check/proj_123 \
  -H "Authorization: Bearer SESSION_TOKEN"
```

Checks are created immediately and executed in the background. The response returns a `running` check record:

```json
{
  "id": "check_123",
  "project_id": "proj_123",
  "status": "running",
  "total_queries": 8,
  "completed_queries": 0,
  "brand_mention_rate": null,
  "summary": null,
  "created_at": "2026-03-22T12:00:00Z",
  "completed_at": null
}
```

**Preconditions**

- Config must exist
- At least one prompt must exist
- At least one selected platform must also have an API key configured

## List Checks

```
GET /v1/ai-mention/checks/:projectId
```

```bash
curl https://api.sassmaker.com/v1/ai-mention/checks/proj_123 \
  -H "Authorization: Bearer SESSION_TOKEN"
```

## Get Check Details

```
GET /v1/ai-mention/checks/:projectId/:checkId
```

Returns the check plus normalized result rows, including parsed competitor mentions and citations.

## Dashboard Payload

```
GET /v1/ai-mention/dashboard/:projectId
```

Use this endpoint to populate the dashboard view in one request. It returns:

- `config`
- `prompts`
- `recent_checks`
- `latest_results`

## CLI Examples

The universal CLI works well for `ai-mention`:

```bash
saasmaker api POST /v1/ai-mention/config/<projectId> --auth session \
  --body '{"brand_name":"Acme","platforms":["openai"],"openai_api_key":"sk-..."}'

saasmaker api POST /v1/ai-mention/check/<projectId> --auth session
saasmaker ai-mention history --project <projectId> --output table
```
