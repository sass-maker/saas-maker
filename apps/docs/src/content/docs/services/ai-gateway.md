---
title: AI Gateway
description: Proxy LLM calls, generate embeddings, and build RAG pipelines through a unified API.
---

The AI Gateway lets you route LLM requests through Foundry with usage tracking, logging, and built-in RAG support.

## Quick Start

No configuration needed — the free tier works out of the box. Just pass your project API key:

```bash
curl -X POST https://api.sassmaker.com/v1/ai/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_your_api_key" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

The free tier routes to open-source models (Llama, Gemini Flash, Mistral) automatically. To use your own provider (OpenAI, Anthropic, etc.), see [Configuration](#configuration) below.

## Endpoints Summary

All endpoints use **API Key** auth via `X-Project-Key` header.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/ai/chat/completions` | Chat completion (proxied to provider) |
| `POST` | `/v1/ai/embeddings` | Generate embeddings |
| `POST` | `/v1/ai/rag` | RAG: search + chat in one call |

## Chat Completions

```
POST /v1/ai/chat/completions
```

```bash
curl -X POST https://api.sassmaker.com/v1/ai/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_your_api_key" \
  -d '{
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "What is Foundry?"}
    ],
    "stream": false
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messages` | array | Yes | OpenAI-format message array (`role` + `content`) |
| `model` | string | No | Override the default model |
| `stream` | boolean | No | Enable SSE streaming (default false) |
| `temperature` | number | No | Sampling temperature (0–2) |
| `max_tokens` | number | No | Max tokens to generate |

**Response** (OpenAI-compatible):

```json
{
  "id": "chatcmpl-abc123",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Foundry is a backend-as-a-service platform..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 42,
    "total_tokens": 67
  }
}
```

**Error responses:**

| Status | Body | Meaning |
|--------|------|---------|
| `400` | `{"error": "AI not configured for this project"}` | No custom config set AND free tier unavailable |
| `400` | `{"error": "messages array is required"}` | Missing messages field |
| `502` | `{"error": "Provider error: ..."}` | Upstream provider failed |

## Embeddings

```
POST /v1/ai/embeddings
```

```bash
curl -X POST https://api.sassmaker.com/v1/ai/embeddings \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_your_api_key" \
  -d '{
    "input": "What is Foundry?",
    "model": "text-embedding-3-small"
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `input` | string or string[] | Yes | Text(s) to embed |
| `model` | string | No | Override the default model |

## RAG (Retrieval-Augmented Generation)

RAG combines Knowledge Base vector search with a chat completion in a single call. **Prerequisite:** you must have a Knowledge Base index with documents already ingested (see the [end-to-end example](#end-to-end-rag-example) below).

```
POST /v1/ai/rag
```

```bash
curl -X POST https://api.sassmaker.com/v1/ai/rag \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_your_api_key" \
  -d '{
    "query": "How do I collect feedback?",
    "index_id": "your-index-id",
    "top_k": 5
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Natural language question |
| `index_id` | string | Yes | Knowledge Base index ID (from `POST /v1/indexes`) |
| `top_k` | number | No | Number of chunks to retrieve (default 5) |
| `system_prompt` | string | No | Custom system prompt |
| `stream` | boolean | No | Enable SSE streaming (default false) |

**Response:**

```json
{
  "response": "You can collect feedback by integrating the feedback widget...",
  "sources": [
    {
      "document_id": "doc_abc",
      "chunk_content": "Use the feedback endpoint to collect bugs...",
      "score": 0.92
    }
  ],
  "usage": {
    "input_tokens": 150,
    "output_tokens": 80
  }
}
```

**What happens under the hood:**

1. Your query is embedded using the project's configured embedding model
2. Top-K chunks are retrieved from the Knowledge Base index via vector similarity
3. Retrieved chunks are injected as context into a chat completion call
4. The LLM response is returned along with the source chunks

**Error responses:**

| Status | Body | Meaning |
|--------|------|---------|
| `400` | `{"error": "AI not configured for this project"}` | No AI config and no free tier |
| `400` | `{"error": "index_id and query are required"}` | Missing required fields |
| `404` | `{"error": "Index not found"}` | Invalid `index_id` |

## End-to-End RAG Example

Here's the complete flow to build a RAG-powered Q&A bot from scratch. All steps use the same `X-Project-Key`.

### Step 1: Create a Knowledge Base index

```bash
curl -X POST https://api.sassmaker.com/v1/indexes \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_your_api_key" \
  -d '{
    "name": "help-docs",
    "embedding_model": "gemini-embedding-001"
  }'
```

Save the `id` from the response — you'll need it as `index_id`.

### Step 2: Ingest documents

```bash
curl -X POST https://api.sassmaker.com/v1/indexes/YOUR_INDEX_ID/documents \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_your_api_key" \
  -d '{
    "content": "Foundry is a backend-as-a-service platform. It provides feedback collection, waitlists, testimonials, changelogs, analytics, knowledge base, and AI gateway services.",
    "metadata": {"source": "docs", "page": "intro"}
  }'
```

Repeat for each document. Content is automatically chunked and embedded.

### Step 3: Ask questions with RAG

```bash
curl -X POST https://api.sassmaker.com/v1/ai/rag \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_your_api_key" \
  -d '{
    "query": "What services does Foundry provide?",
    "index_id": "YOUR_INDEX_ID",
    "top_k": 3
  }'
```

The response includes the AI-generated answer and the source chunks it used.

## Configuration

By default, the free tier is used — no setup needed. To use your own provider:

### Set custom provider (Dashboard or API)

Config endpoints require a **session token** (not API key) because they contain sensitive credentials.

```
PUT /v1/ai/config/:projectId
```

```bash
curl -X PUT https://api.sassmaker.com/v1/ai/config/YOUR_PROJECT_ID \
  -H "Authorization: Bearer SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ai_base_url": "https://api.openai.com/v1",
    "ai_api_key": "sk-...",
    "ai_model": "gpt-4o"
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ai_base_url` | string | Yes | Provider base URL (must be OpenAI-compatible) |
| `ai_api_key` | string | Yes | Provider API key |
| `ai_model` | string | Yes | Default model name |

### Get current config

```
GET /v1/ai/config/:projectId
```

**Auth:** Session token. Returns config with the API key masked.

### Reset to free tier

```
DELETE /v1/ai/config/:projectId
```

**Auth:** Session token. Removes custom config; the project falls back to free tier.

## Free Tier Models

When no custom provider is configured, requests are routed through the free AI gateway which automatically selects from:

**Chat models:**

| Model | Provider |
|-------|----------|
| `@cf/meta/llama-3.1-8b-instruct` | Cloudflare Workers AI |
| `@cf/mistral/mistral-7b-instruct-v0.1` | Cloudflare Workers AI |
| `llama-3.1-8b-instant` | Groq |
| `llama-3.3-70b-versatile` | Groq |
| `gemini-2.0-flash-lite` | Google Gemini |
| `gemini-2.0-flash` | Google Gemini |

**Embedding models:**

| Model | Provider |
|-------|----------|
| `gemini-embedding-001` | Google Gemini |
| `voyage-3.5-lite` | Voyage AI |
| `@cf/baai/bge-base-en-v1.5` | Cloudflare Workers AI |

The free tier uses health-aware routing — if one provider is down, requests are automatically routed to the next available model.

## Usage & Logs

These endpoints require a **session token** (dashboard auth).

### Usage stats

```
GET /v1/ai/usage/:projectId?days=30
```

Returns: `total_requests`, `success_count`, `error_count`, `avg_latency_ms`, `total_input_tokens`, `total_output_tokens`.

### Request logs

```
GET /v1/ai/requests/:projectId?limit=50&offset=0
```

Returns individual request logs with endpoint, model, status, latency, and token counts.

## SDK Usage

```typescript
import { SaaSMakerClient } from '@foundry/sdk';

const client = new SaaSMakerClient({ apiKey: 'pk_your_api_key' });

// Chat completion
const chat = await client.ai.chat({
  messages: [{ role: 'user', content: 'What is Foundry?' }],
});

// Embeddings
const embeddings = await client.ai.embed('What is Foundry?');

// RAG (requires a Knowledge Base index with documents)
const answer = await client.ai.rag({
  query: 'How do I collect feedback?',
  index_id: 'your-index-id',
  top_k: 5,
});
```
