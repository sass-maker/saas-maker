---
title: Knowledge Base (Vector Search)
description: Build a semantic search / RAG-powered knowledge base with automatic chunking and embedding.
---

Upload documents and search them with natural language queries. SaaS Maker automatically chunks your content, generates embeddings, and stores them for fast vector similarity search.

## How it works

1. **Create an index** to organize documents by topic
2. **Upload documents** -- content is automatically chunked and embedded
3. **Search** with natural language queries to find relevant chunks

## Embedding models

Each project is locked to a single embedding model after its first index creation. Use `GET /v1/indexes/models` to list available models.

| Model | Provider | Dimensions | Notes |
|-------|----------|-----------|-------|
| `voyage-4-large` | Voyage AI | 1024 | Best quality, multilingual |
| `voyage-4` | Voyage AI | 1024 | General purpose |
| `voyage-4-lite` | Voyage AI | 1024 | Fast and cheap |
| `voyage-code-3` | Voyage AI | 1024 | Code-optimized |
| `gemini-embedding-001` | Google | 3072 | 100+ languages |
| `@cf/baai/bge-base-en-v1.5` | Cloudflare | 768 | Fast English (free) |
| `@cf/baai/bge-large-en-v1.5` | Cloudflare | 1024 | Quality English (free) |
| `@cf/baai/bge-m3` | Cloudflare | 1024 | Multilingual (free) |

## API endpoints

### List available models

```
GET /v1/indexes/models
```

**Auth:** None

### Create an index

```
POST /v1/indexes
```

**Auth:** API Key

```bash
curl -X POST https://api.sassmaker.com/v1/indexes \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_abc123" \
  -d '{
    "name": "help-docs",
    "embedding_model": "@cf/baai/bge-base-en-v1.5"
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Index name (unique per project) |
| `embedding_model` | string | On first use | Required on the first index creation to lock the project model |
| `external_id` | string | No | Optional external identifier |

### List indexes

```
GET /v1/indexes
```

**Auth:** API Key

### Upload a document

```
POST /v1/indexes/:indexId/documents
```

**Auth:** API Key

```bash
curl -X POST https://api.sassmaker.com/v1/indexes/idx_123/documents \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_abc123" \
  -d '{
    "content": "SaaS Maker is a backend-as-a-service platform for SaaS apps...",
    "metadata": { "source": "docs", "page": "intro" }
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | Document text (max 100KB) |
| `metadata` | object | No | Arbitrary key-value metadata |

**Response:**

```json
{
  "id": "doc_abc",
  "index_id": "idx_123",
  "chunks_created": 4,
  "created_at": "2025-01-01T00:00:00Z"
}
```

### List documents

```
GET /v1/indexes/:indexId/documents?page=1
```

**Auth:** API Key

### Search

```
POST /v1/indexes/:indexId/search
```

**Auth:** API Key

```bash
curl -X POST https://api.sassmaker.com/v1/indexes/idx_123/search \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_abc123" \
  -d '{
    "query": "how do I collect feedback?",
    "top_k": 5
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Natural language search query |
| `top_k` | number | No | Number of results (default 5, max 20) |

**Response:**

```json
{
  "results": [
    {
      "document_id": "doc_abc",
      "chunk_content": "Use the feedback endpoint to collect bugs and feature requests...",
      "score": 0.92,
      "metadata": { "source": "docs", "page": "feedback" }
    }
  ]
}
```

### Delete a document

```
DELETE /v1/indexes/:indexId/documents/:docId
```

**Auth:** API Key

Deleting a document also deletes all its chunks.

### Delete an index

```
DELETE /v1/indexes/:indexId
```

**Auth:** API Key
