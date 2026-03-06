---
title: AI Gateway
description: Proxy LLM calls, generate embeddings, and build RAG pipelines through a unified API.
---

The AI Gateway lets you route LLM requests through SaaS Maker with usage tracking, logging, and built-in RAG support. Bring your own provider (OpenAI, Anthropic, etc.) or use the free tier.

## How it works

1. **Configure your AI provider** — set base URL, API key, and default model per project
2. **Call the proxy endpoints** — chat completions, embeddings, or RAG
3. **View usage** — token counts, latency, and request logs in the dashboard

## Configuration

Configure AI settings per project via the dashboard or API. If no project-level config is set, the free tier (GPT-4o-mini) is used automatically.

### Get config

```
GET /v1/ai/config/:projectId
```

**Auth:** Session token

### Set config

```
PUT /v1/ai/config/:projectId
```

**Auth:** Session token

```bash
curl -X PUT https://api.sassmaker.com/v1/ai/config/PROJECT_ID \
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
| `ai_base_url` | string | Yes | Provider base URL (OpenAI-compatible) |
| `ai_api_key` | string | Yes | Provider API key |
| `ai_model` | string | Yes | Default model |

### Delete config

```
DELETE /v1/ai/config/:projectId
```

**Auth:** Session token

Removes custom config. The project falls back to the free tier.

## Chat Completions

Proxy chat requests to your configured provider.

```
POST /v1/ai/chat/completions
```

**Auth:** API Key

```bash
curl -X POST https://api.sassmaker.com/v1/ai/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_your_api_key" \
  -d '{
    "messages": [
      { "role": "user", "content": "What is SaaS Maker?" }
    ],
    "stream": false
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messages` | array | Yes | OpenAI-format message array |
| `model` | string | No | Override the default model |
| `stream` | boolean | No | Enable SSE streaming (default false) |
| `temperature` | number | No | Sampling temperature |
| `max_tokens` | number | No | Max tokens to generate |

Returns the provider's response directly (OpenAI-compatible format).

## Embeddings

Generate embeddings via your configured provider.

```
POST /v1/ai/embeddings
```

**Auth:** API Key

```bash
curl -X POST https://api.sassmaker.com/v1/ai/embeddings \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_your_api_key" \
  -d '{
    "input": "What is SaaS Maker?",
    "model": "text-embedding-3-small"
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `input` | string | Yes | Text to embed |
| `model` | string | No | Override the default model |

## RAG (Retrieval-Augmented Generation)

Combines vector search with chat completion in a single call. Embeds your query, searches a knowledge base index, and generates a response grounded in the retrieved context.

```
POST /v1/ai/rag
```

**Auth:** API Key

```bash
curl -X POST https://api.sassmaker.com/v1/ai/rag \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_your_api_key" \
  -d '{
    "query": "How do I collect feedback?",
    "index_id": "idx_123",
    "top_k": 5
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Natural language question |
| `index_id` | string | Yes | Knowledge base index to search |
| `top_k` | number | No | Number of chunks to retrieve (default 5) |
| `system_prompt` | string | No | Custom system prompt |
| `stream` | boolean | No | Enable SSE streaming (default false) |

**What happens under the hood:**

1. Query is embedded using your configured provider
2. Top-K chunks are retrieved from the index via vector similarity
3. Chunks are injected as context into a chat completion call
4. Response is returned (optionally streamed)

## Usage & Logs

### Usage stats

```
GET /v1/ai/usage/:projectId?days=30
```

**Auth:** Session token

Returns aggregated stats: total requests, success/error counts, average latency, total input/output tokens.

### Request logs

```
GET /v1/ai/requests/:projectId?limit=50&offset=0
```

**Auth:** Session token

Returns individual request logs with endpoint, model, status, latency, and token counts.

## SDK Usage

```typescript
import { SaaSMakerClient } from '@saas-maker/sdk';

const client = new SaaSMakerClient({
  apiKey: 'pk_your_api_key',
  baseUrl: 'https://api.sassmaker.com',
});

// Chat completion
const response = await client.ai.chat({
  messages: [{ role: 'user', content: 'What is SaaS Maker?' }],
});

// Embeddings
const embeddings = await client.ai.embed('What is SaaS Maker?');

// RAG
const answer = await client.ai.rag({
  query: 'How do I collect feedback?',
  index_id: 'idx_123',
  top_k: 5,
});
```
