# Vector Memory Service — Design

## Overview

A semantic search API added to the existing saas-maker platform. Users create indexes, send documents (which are automatically chunked and embedded), and run similarity search queries. Use cases include repo search, feedback search, journal entry search, etc.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Vector store | CockroachDB (existing) | 10 GiB free, pgvector-compatible VECTOR type, zero new infra |
| Embeddings | Voyage AI via free-ai gateway | 200M free tokens, top-tier quality, abstracted behind existing gateway |
| API location | New routes in existing Hono worker | Shares auth, CORS, DB connection. Can split later if needed |
| Auth | Same project + API key model | Reuses existing apiKeyAuth middleware, indexes scoped to projects |
| Chunking | Server-side, automatic | Better DX, consistent chunk sizes |
| Multi-tenancy | Indexes scoped to project_id | Same pattern as feedback module |

## Architecture

```
User App
  |
  +-- X-Project-Key header
  |
  v
Cloudflare Worker (Hono)
  +-- /v1/feedback/*   (existing)
  +-- /v1/indexes/*    (new)
  |     |
  |     +---> free-ai gateway ---> Voyage AI (embeddings)
  |     |
  |     +---> CockroachDB (vectors + metadata)
```

## Database Schema

```sql
CREATE TABLE indexes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_id UUID NOT NULL REFERENCES indexes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  index_id UUID NOT NULL REFERENCES indexes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1536) NOT NULL,
  chunk_index INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chunks_index_id ON chunks(index_id);
```

## API Endpoints

All routes require `X-Project-Key` header (API key auth).

### Indexes

| Method | Path | Description |
|--------|------|-------------|
| POST | /v1/indexes | Create an index |
| GET | /v1/indexes | List indexes for project |
| DELETE | /v1/indexes/:indexId | Delete index (cascades) |

**POST /v1/indexes**
```json
// Request
{ "name": "repo-docs", "external_id": "repo-123" }

// Response 201
{ "id": "uuid", "name": "repo-docs", "external_id": "repo-123", "project_id": "uuid", "created_at": "..." }
```

### Documents

| Method | Path | Description |
|--------|------|-------------|
| POST | /v1/indexes/:indexId/documents | Ingest a document |
| GET | /v1/indexes/:indexId/documents | List documents (paginated) |
| DELETE | /v1/indexes/:indexId/documents/:docId | Delete document + chunks |

**POST /v1/indexes/:indexId/documents**
```json
// Request
{ "content": "Long text content here...", "metadata": { "source": "readme.md" } }

// Response 201
{ "id": "uuid", "index_id": "uuid", "chunks_created": 5, "created_at": "..." }
```

Processing: content -> chunk -> embed via free-ai gateway -> store chunks with vectors.

### Search

| Method | Path | Description |
|--------|------|-------------|
| POST | /v1/indexes/:indexId/search | Semantic search |

**POST /v1/indexes/:indexId/search**
```json
// Request
{ "query": "how does authentication work?", "top_k": 5 }

// Response 200
{
  "results": [
    {
      "document_id": "uuid",
      "chunk_content": "Authentication uses JWT tokens...",
      "score": 0.92,
      "metadata": { "source": "auth.md" }
    }
  ]
}
```

## Chunking Strategy

- Split on paragraph boundaries (\n\n)
- Target ~500 tokens per chunk (~2000 chars)
- ~50 token overlap between chunks for context continuity
- If a single paragraph exceeds the limit, split on sentence boundaries
- No external library needed — string processing in the Worker

## Embedding Flow

**Ingestion:**
content -> chunker -> chunks[] -> POST free-ai/voyage/embed -> vectors[] -> INSERT into chunks table

**Search:**
query -> POST free-ai/voyage/embed -> query_vector -> SELECT ... ORDER BY embedding <=> query_vector WHERE index_id = ? LIMIT top_k

Model: voyage-3 (1536 dimensions). All vectors in the same embedding space.

## Error Handling

| Condition | Response |
|-----------|----------|
| Index not found / not owned by project | 404 |
| Duplicate index name within project | 409 |
| Empty content | 400 |
| Embedding API failure (free-ai gateway) | 502 |
| Content too large (>100KB) | 413 |

## Not in v1

- No batch document ingestion (one doc at a time)
- No metadata filtering in search
- No hybrid search (keyword + vector)
- No async ingestion queue (embedding is synchronous)
- No usage tracking / rate limiting beyond existing
- No vector index (brute-force scan, sufficient up to ~50K vectors per index scope)
