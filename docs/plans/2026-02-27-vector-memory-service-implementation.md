# Vector Memory Service Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add semantic search API to saas-maker — users create indexes, ingest documents (auto-chunked + embedded via Voyage AI), and run similarity search queries.

**Architecture:** New Hono routes in the existing Cloudflare Worker (`/v1/indexes`, nested `/documents` and `/search`). CockroachDB stores vectors using pgvector-compatible `VECTOR(1536)` type. Embeddings generated via Voyage AI through the user's free-ai gateway. Auth reuses existing `requireApiKey` middleware.

**Tech Stack:** Hono, CockroachDB (pgvector), Voyage AI (via free-ai gateway), TypeScript, Vitest

---

### Task 1: Add shared types for vector memory service

**Files:**
- Modify: `packages/shared-types/src/index.ts`

**Step 1: Add vector memory types to shared-types**

Add these types at the end of `packages/shared-types/src/index.ts`:

```typescript
// --- Vector Memory Service ---

export interface IndexRecord {
  id: string;
  project_id: string;
  name: string;
  external_id: string | null;
  created_at: string;
}

export interface DocumentRecord {
  id: string;
  index_id: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ChunkRecord {
  id: string;
  document_id: string;
  index_id: string;
  content: string;
  chunk_index: number;
  created_at: string;
}

export interface CreateIndexRequest {
  name: string;
  external_id?: string;
}

export interface IngestDocumentRequest {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SearchRequest {
  query: string;
  top_k?: number;
}

export interface SearchResult {
  document_id: string;
  chunk_content: string;
  score: number;
  metadata: Record<string, unknown>;
}
```

**Step 2: Build shared-types**

Run: `pnpm -F @saas-maker/shared-types build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add packages/shared-types/src/index.ts
git commit -m "feat(types): add vector memory service types"
```

---

### Task 2: Add database migration for vector tables

**Files:**
- Create: `packages/db/migrations/0003_vector_memory.sql`

**Step 1: Write the migration**

Create `packages/db/migrations/0003_vector_memory.sql`:

```sql
-- Vector memory service tables

CREATE TABLE IF NOT EXISTS indexes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  index_id TEXT NOT NULL REFERENCES indexes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  index_id TEXT NOT NULL REFERENCES indexes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1536) NOT NULL,
  chunk_index INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_indexes_project ON indexes(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_index ON documents(index_id);
CREATE INDEX IF NOT EXISTS idx_chunks_index ON chunks(index_id);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
```

**Step 2: Commit**

```bash
git add packages/db/migrations/0003_vector_memory.sql
git commit -m "feat(db): add vector memory migration"
```

---

### Task 3: Add database interface methods for vector memory

**Files:**
- Modify: `packages/db/src/index.ts`
- Modify: `packages/db/src/schema.ts`

**Step 1: Update TABLES in schema.ts**

Add to `packages/db/src/schema.ts`:

```typescript
export const TABLES = {
  users: 'users',
  projects: 'projects',
  feedback: 'feedback',
  upvotes: 'upvotes',
  sessions: 'sessions',
  indexes: 'indexes',
  documents: 'documents',
  chunks: 'chunks',
} as const;
```

**Step 2: Add vector methods to database interface**

Add these imports and methods to `packages/db/src/index.ts`:

Add to imports:
```typescript
import {
  // ... existing imports ...
  IndexRecord,
  DocumentRecord,
  ChunkRecord,
} from '@saas-maker/shared-types';
```

Add to the `FeedbackDatabase` interface (before the closing `}`):

```typescript
  // Vector Memory - Indexes
  createIndex(input: { id: string; project_id: string; name: string; external_id: string | null }): Promise<IndexRecord>;
  getIndexById(id: string): Promise<IndexRecord | null>;
  listIndexesByProject(projectId: string): Promise<(IndexRecord & { document_count: number })[]>;
  deleteIndex(id: string): Promise<boolean>;

  // Vector Memory - Documents
  createDocument(input: { id: string; index_id: string; content: string; metadata: Record<string, unknown> }): Promise<DocumentRecord>;
  getDocumentById(id: string): Promise<DocumentRecord | null>;
  listDocumentsByIndex(indexId: string, page: number, limit: number): Promise<{ data: DocumentRecord[]; total: number }>;
  deleteDocument(id: string): Promise<boolean>;

  // Vector Memory - Chunks
  createChunks(chunks: { id: string; document_id: string; index_id: string; content: string; embedding: number[]; chunk_index: number }[]): Promise<number>;
  searchChunks(indexId: string, queryEmbedding: number[], topK: number): Promise<{ document_id: string; content: string; score: number; metadata: Record<string, unknown> }[]>;
  deleteChunksByDocument(documentId: string): Promise<boolean>;
```

**Step 3: Build db package**

Run: `pnpm -F @saas-maker/db build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/db/src/index.ts packages/db/src/schema.ts
git commit -m "feat(db): add vector memory interface methods"
```

---

### Task 4: Implement database methods for vector memory

**Files:**
- Modify: `workers/api/src/db.ts`

**Step 1: Add vector memory implementations to createDatabase()**

Add these method implementations inside the return object of `createDatabase()` in `workers/api/src/db.ts`, after the existing upvotes/sessions methods:

```typescript
    // --- Vector Memory: Indexes ---
    async createIndex(input) {
      const [row] = await sql`
        INSERT INTO indexes (id, project_id, name, external_id)
        VALUES (${input.id}, ${input.project_id}, ${input.name}, ${input.external_id})
        RETURNING *
      `;
      return row as IndexRecord;
    },

    async getIndexById(id) {
      const [row] = await sql`SELECT * FROM indexes WHERE id = ${id}`;
      return (row as IndexRecord) || null;
    },

    async listIndexesByProject(projectId) {
      const rows = await sql`
        SELECT i.*, COALESCE(d.cnt, 0)::int AS document_count
        FROM indexes i
        LEFT JOIN (SELECT index_id, COUNT(*) AS cnt FROM documents GROUP BY index_id) d
          ON d.index_id = i.id
        WHERE i.project_id = ${projectId}
        ORDER BY i.created_at DESC
      `;
      return rows as unknown as (IndexRecord & { document_count: number })[];
    },

    async deleteIndex(id) {
      const result = await sql`DELETE FROM indexes WHERE id = ${id}`;
      return result.count > 0;
    },

    // --- Vector Memory: Documents ---
    async createDocument(input) {
      const [row] = await sql`
        INSERT INTO documents (id, index_id, content, metadata)
        VALUES (${input.id}, ${input.index_id}, ${input.content}, ${JSON.stringify(input.metadata)})
        RETURNING *
      `;
      return row as DocumentRecord;
    },

    async getDocumentById(id) {
      const [row] = await sql`SELECT * FROM documents WHERE id = ${id}`;
      return (row as DocumentRecord) || null;
    },

    async listDocumentsByIndex(indexId, page, limit) {
      const offset = (page - 1) * limit;
      const [countResult] = await sql`SELECT COUNT(*)::int AS total FROM documents WHERE index_id = ${indexId}`;
      const rows = await sql`
        SELECT * FROM documents WHERE index_id = ${indexId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return { data: rows as unknown as DocumentRecord[], total: countResult.total };
    },

    async deleteDocument(id) {
      const result = await sql`DELETE FROM documents WHERE id = ${id}`;
      return result.count > 0;
    },

    // --- Vector Memory: Chunks ---
    async createChunks(chunks) {
      if (chunks.length === 0) return 0;
      const values = chunks.map(c => ({
        id: c.id,
        document_id: c.document_id,
        index_id: c.index_id,
        content: c.content,
        embedding: `[${c.embedding.join(',')}]`,
        chunk_index: c.chunk_index,
      }));
      await sql`
        INSERT INTO chunks ${sql(values, 'id', 'document_id', 'index_id', 'content', 'embedding', 'chunk_index')}
      `;
      return chunks.length;
    },

    async searchChunks(indexId, queryEmbedding, topK) {
      const embeddingStr = `[${queryEmbedding.join(',')}]`;
      const rows = await sql`
        SELECT c.document_id, c.content, d.metadata,
               (c.embedding <=> ${embeddingStr}::vector) AS distance
        FROM chunks c
        JOIN documents d ON d.id = c.document_id
        WHERE c.index_id = ${indexId}
        ORDER BY c.embedding <=> ${embeddingStr}::vector
        LIMIT ${topK}
      `;
      return (rows as unknown as { document_id: string; content: string; metadata: Record<string, unknown>; distance: number }[])
        .map(r => ({
          document_id: r.document_id,
          content: r.content,
          score: 1 - r.distance,
          metadata: r.metadata,
        }));
    },

    async deleteChunksByDocument(documentId) {
      const result = await sql`DELETE FROM chunks WHERE document_id = ${documentId}`;
      return result.count > 0;
    },
```

Also add imports at the top of `workers/api/src/db.ts`:

```typescript
import type {
  // ... existing imports ...
  IndexRecord,
  DocumentRecord,
  ChunkRecord,
} from '@saas-maker/shared-types';
```

**Step 2: Build API to verify compilation**

Run: `pnpm -F @saas-maker/api build`
Expected: Build succeeds (or `wrangler deploy --dry-run` succeeds)

**Step 3: Commit**

```bash
git add workers/api/src/db.ts
git commit -m "feat(db): implement vector memory database methods"
```

---

### Task 5: Add text chunking utility

**Files:**
- Create: `workers/api/src/chunker.ts`

**Step 1: Write the failing test**

Create `tests/api/chunker.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { chunkText } from '../../workers/api/src/chunker';

describe('chunkText', () => {
  it('returns single chunk for short text', () => {
    const chunks = chunkText('Hello world');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('Hello world');
  });

  it('splits on paragraph boundaries', () => {
    const text = 'Paragraph one.\n\nParagraph two.\n\nParagraph three.';
    const chunks = chunkText(text, { maxChars: 30, overlapChars: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toContain('Paragraph one');
  });

  it('respects maxChars limit', () => {
    const text = Array(20).fill('This is a sentence.').join('\n\n');
    const chunks = chunkText(text, { maxChars: 100, overlapChars: 0 });
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(120); // allow small overshoot for paragraph boundary
    }
  });

  it('handles text with no paragraph breaks', () => {
    const text = Array(100).fill('word').join(' ');
    const chunks = chunkText(text, { maxChars: 50, overlapChars: 0 });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('returns empty array for empty text', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   ')).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/api/chunker.test.ts`
Expected: FAIL — module not found

**Step 3: Write the chunker implementation**

Create `workers/api/src/chunker.ts`:

```typescript
interface ChunkOptions {
  maxChars?: number;
  overlapChars?: number;
}

const DEFAULT_MAX_CHARS = 2000; // ~500 tokens
const DEFAULT_OVERLAP_CHARS = 200; // ~50 tokens

export function chunkText(
  text: string,
  options: ChunkOptions = {}
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlapChars = options.overlapChars ?? DEFAULT_OVERLAP_CHARS;

  if (trimmed.length <= maxChars) return [trimmed];

  // Split on paragraph boundaries first
  const paragraphs = trimmed.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    const candidate = current ? current + '\n\n' + para : para;

    if (candidate.length > maxChars && current) {
      chunks.push(current.trim());
      // Start next chunk with overlap from end of current
      const overlap = current.slice(-overlapChars).trim();
      current = overlap ? overlap + '\n\n' + para : para;
    } else {
      current = candidate;
    }
  }

  // If current chunk is still too long (single huge paragraph), split on sentences
  if (current.length > maxChars) {
    const sentences = current.split(/(?<=[.!?])\s+/);
    let buf = '';
    for (const sentence of sentences) {
      const candidate = buf ? buf + ' ' + sentence : sentence;
      if (candidate.length > maxChars && buf) {
        chunks.push(buf.trim());
        const overlap = buf.slice(-overlapChars).trim();
        buf = overlap ? overlap + ' ' + sentence : sentence;
      } else {
        buf = candidate;
      }
    }
    if (buf.trim()) chunks.push(buf.trim());
  } else if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/api/chunker.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add workers/api/src/chunker.ts tests/api/chunker.test.ts
git commit -m "feat: add text chunking utility for vector memory"
```

---

### Task 6: Add embedding client

**Files:**
- Create: `workers/api/src/embeddings.ts`

**Step 1: Write the embedding client**

Create `workers/api/src/embeddings.ts`:

```typescript
export interface EmbeddingResponse {
  embeddings: number[][];
}

export async function getEmbeddings(
  freeAiBaseUrl: string,
  texts: string[]
): Promise<number[][]> {
  const response = await fetch(`${freeAiBaseUrl}/v1/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'voyage-3',
      input: texts,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as { data: { embedding: number[] }[] };
  return data.data.map((d) => d.embedding);
}
```

Note: The exact request/response shape may need adjustment based on how your free-ai gateway proxies to Voyage AI. The OpenAI-compatible format (`/v1/embeddings` with `data[].embedding`) is the most common pattern.

**Step 2: Commit**

```bash
git add workers/api/src/embeddings.ts
git commit -m "feat: add embedding client for free-ai gateway"
```

---

### Task 7: Add FREE_AI_BASE_URL to worker bindings

**Files:**
- Modify: `workers/api/src/types.ts`
- Modify: `workers/api/wrangler.toml`

**Step 1: Add to Bindings type**

In `workers/api/src/types.ts`, add `FREE_AI_BASE_URL` to `Bindings`:

```typescript
export type Bindings = {
  AUTH_SECRET: string;
  APP_BASE_URL: string;
  CORS_ORIGIN: string;
  DATABASE_URL: string;
  FEEDBACK_IMAGES: R2Bucket;
  RESEND_API_KEY: string;
  NOTIFICATION_FROM_EMAIL: string;
  FREE_AI_BASE_URL: string;
};
```

**Step 2: Update test helper**

In `tests/api/helpers.ts`, add `FREE_AI_BASE_URL` to mock bindings:

```typescript
FREE_AI_BASE_URL: 'http://localhost:8787',
```

**Step 3: Commit**

```bash
git add workers/api/src/types.ts tests/api/helpers.ts
git commit -m "feat: add FREE_AI_BASE_URL binding"
```

---

### Task 8: Create index routes

**Files:**
- Create: `workers/api/src/routes/indexes.ts`
- Modify: `workers/api/src/index.ts`

**Step 1: Write the failing tests**

Create `tests/api/indexes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { request } from './helpers';

describe('Index routes require API key', () => {
  it('POST /v1/indexes without X-Project-Key returns 401', async () => {
    const res = await request('/v1/indexes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test-index' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });

  it('GET /v1/indexes without X-Project-Key returns 401', async () => {
    const res = await request('/v1/indexes');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });

  it('DELETE /v1/indexes/123 without X-Project-Key returns 401', async () => {
    const res = await request('/v1/indexes/123', { method: 'DELETE' });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });
});

describe('Document routes require API key', () => {
  it('POST /v1/indexes/123/documents without X-Project-Key returns 401', async () => {
    const res = await request('/v1/indexes/123/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'test' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });

  it('GET /v1/indexes/123/documents without X-Project-Key returns 401', async () => {
    const res = await request('/v1/indexes/123/documents');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });

  it('DELETE /v1/indexes/123/documents/456 without X-Project-Key returns 401', async () => {
    const res = await request('/v1/indexes/123/documents/456', { method: 'DELETE' });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });
});

describe('Search routes require API key', () => {
  it('POST /v1/indexes/123/search without X-Project-Key returns 401', async () => {
    const res = await request('/v1/indexes/123/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/X-Project-Key/i);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/api/indexes.test.ts`
Expected: FAIL — routes don't exist yet (likely 404s)

**Step 3: Write the indexes route file**

Create `workers/api/src/routes/indexes.ts`:

```typescript
import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey } from '../middleware/auth';
import { getDb } from '../db';
import { chunkText } from '../chunker';
import { getEmbeddings } from '../embeddings';
import type { CreateIndexRequest, IngestDocumentRequest, SearchRequest } from '@saas-maker/shared-types';

const indexes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

indexes.use('*', requireApiKey);

const MAX_CONTENT_SIZE = 100 * 1024; // 100KB
const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 20;
const PAGE_SIZE = 20;

// --- Index CRUD ---

indexes.post('/', async (c) => {
  const projectId = c.get('projectId')!;
  const body = (await c.req.json()) as CreateIndexRequest;

  if (!body.name?.trim()) return c.json({ error: 'Index name is required' }, 400);

  const db = getDb(c.env.DATABASE_URL);

  try {
    const record = await db.createIndex({
      id: crypto.randomUUID(),
      project_id: projectId,
      name: body.name.trim(),
      external_id: body.external_id?.trim() || null,
    });
    return c.json(record, 201);
  } catch (e: any) {
    if (e.message?.includes('duplicate') || e.code === '23505') {
      return c.json({ error: 'Index name already exists in this project' }, 409);
    }
    throw e;
  }
});

indexes.get('/', async (c) => {
  const projectId = c.get('projectId')!;
  const db = getDb(c.env.DATABASE_URL);
  const data = await db.listIndexesByProject(projectId);
  return c.json({ data });
});

indexes.delete('/:indexId', async (c) => {
  const projectId = c.get('projectId')!;
  const indexId = c.req.param('indexId');
  const db = getDb(c.env.DATABASE_URL);

  const existing = await db.getIndexById(indexId);
  if (!existing) return c.json({ error: 'Index not found' }, 404);
  if (existing.project_id !== projectId) return c.json({ error: 'Forbidden' }, 403);

  await db.deleteIndex(indexId);
  return c.json({ ok: true });
});

// --- Document ingestion ---

indexes.post('/:indexId/documents', async (c) => {
  const projectId = c.get('projectId')!;
  const indexId = c.req.param('indexId');
  const body = (await c.req.json()) as IngestDocumentRequest;

  if (!body.content?.trim()) return c.json({ error: 'Content is required' }, 400);
  if (body.content.length > MAX_CONTENT_SIZE) return c.json({ error: 'Content too large. Max 100KB' }, 413);

  const db = getDb(c.env.DATABASE_URL);

  const index = await db.getIndexById(indexId);
  if (!index) return c.json({ error: 'Index not found' }, 404);
  if (index.project_id !== projectId) return c.json({ error: 'Forbidden' }, 403);

  // Create document record
  const docId = crypto.randomUUID();
  const document = await db.createDocument({
    id: docId,
    index_id: indexId,
    content: body.content,
    metadata: body.metadata || {},
  });

  // Chunk the content
  const textChunks = chunkText(body.content);

  if (textChunks.length > 0) {
    // Get embeddings from free-ai gateway
    const embeddings = await getEmbeddings(c.env.FREE_AI_BASE_URL, textChunks);

    // Store chunks with embeddings
    const chunkRecords = textChunks.map((text, i) => ({
      id: crypto.randomUUID(),
      document_id: docId,
      index_id: indexId,
      content: text,
      embedding: embeddings[i],
      chunk_index: i,
    }));

    await db.createChunks(chunkRecords);
  }

  return c.json({
    id: document.id,
    index_id: indexId,
    chunks_created: textChunks.length,
    created_at: document.created_at,
  }, 201);
});

indexes.get('/:indexId/documents', async (c) => {
  const projectId = c.get('projectId')!;
  const indexId = c.req.param('indexId');
  const page = parseInt(c.req.query('page') || '1', 10);

  const db = getDb(c.env.DATABASE_URL);

  const index = await db.getIndexById(indexId);
  if (!index) return c.json({ error: 'Index not found' }, 404);
  if (index.project_id !== projectId) return c.json({ error: 'Forbidden' }, 403);

  const result = await db.listDocumentsByIndex(indexId, page, PAGE_SIZE);
  return c.json({ data: result.data, total: result.total, page, limit: PAGE_SIZE });
});

indexes.delete('/:indexId/documents/:docId', async (c) => {
  const projectId = c.get('projectId')!;
  const indexId = c.req.param('indexId');
  const docId = c.req.param('docId');

  const db = getDb(c.env.DATABASE_URL);

  const index = await db.getIndexById(indexId);
  if (!index) return c.json({ error: 'Index not found' }, 404);
  if (index.project_id !== projectId) return c.json({ error: 'Forbidden' }, 403);

  const doc = await db.getDocumentById(docId);
  if (!doc || doc.index_id !== indexId) return c.json({ error: 'Document not found' }, 404);

  await db.deleteDocument(docId); // cascades to chunks
  return c.json({ ok: true });
});

// --- Search ---

indexes.post('/:indexId/search', async (c) => {
  const projectId = c.get('projectId')!;
  const indexId = c.req.param('indexId');
  const body = (await c.req.json()) as SearchRequest;

  if (!body.query?.trim()) return c.json({ error: 'Query is required' }, 400);

  const topK = Math.min(body.top_k || DEFAULT_TOP_K, MAX_TOP_K);

  const db = getDb(c.env.DATABASE_URL);

  const index = await db.getIndexById(indexId);
  if (!index) return c.json({ error: 'Index not found' }, 404);
  if (index.project_id !== projectId) return c.json({ error: 'Forbidden' }, 403);

  // Embed the query
  const [queryEmbedding] = await getEmbeddings(c.env.FREE_AI_BASE_URL, [body.query]);

  // Search
  const results = await db.searchChunks(indexId, queryEmbedding, topK);

  return c.json({ results });
});

export { indexes };
```

**Step 4: Register the route in the main app**

In `workers/api/src/index.ts`, add the import and route:

Add import:
```typescript
import { indexes } from './routes/indexes';
```

Add route (after the existing routes):
```typescript
app.route('/v1/indexes', indexes);
```

**Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/api/indexes.test.ts`
Expected: All auth guard tests PASS

**Step 6: Run all existing tests to verify no regressions**

Run: `pnpm vitest run`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add workers/api/src/routes/indexes.ts workers/api/src/index.ts tests/api/indexes.test.ts
git commit -m "feat: add vector memory API routes (indexes, documents, search)"
```

---

### Task 9: Run the migration against CockroachDB

**Prerequisite:** Requires a running CockroachDB instance with `DATABASE_URL` available.

**Step 1: Run the migration**

```bash
# From the project root, connect to CockroachDB and run the migration
# The exact command depends on how migrations are run in this project.
# Check if there's a migrate script or run manually:
cat packages/db/migrations/0003_vector_memory.sql | cockroach sql --url "$DATABASE_URL"
# Or if using psql:
psql "$DATABASE_URL" -f packages/db/migrations/0003_vector_memory.sql
```

**Step 2: Verify tables exist**

```sql
SELECT table_name FROM information_schema.tables WHERE table_name IN ('indexes', 'documents', 'chunks');
```

Expected: All three tables listed.

**Step 3: Verify VECTOR type works**

```sql
SELECT '[1,2,3]'::vector(3);
```

Expected: Returns the vector. If this fails, CockroachDB may need the pgvector extension enabled or a version upgrade to v25.1+.

---

### Task 10: End-to-end smoke test

**Step 1: Start the dev server**

Run: `pnpm dev:api`

**Step 2: Test index creation**

```bash
curl -X POST http://localhost:8787/v1/indexes \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: <your-api-key>" \
  -d '{"name": "test-index", "external_id": "test-123"}'
```

Expected: 201 with index record

**Step 3: Test document ingestion**

```bash
curl -X POST http://localhost:8787/v1/indexes/<index-id>/documents \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: <your-api-key>" \
  -d '{"content": "Authentication in our app uses JWT tokens. Users log in with their email and password, and receive a token that expires after 24 hours.", "metadata": {"source": "auth-docs"}}'
```

Expected: 201 with document ID and `chunks_created > 0`

**Step 4: Test search**

```bash
curl -X POST http://localhost:8787/v1/indexes/<index-id>/search \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: <your-api-key>" \
  -d '{"query": "how does login work?", "top_k": 3}'
```

Expected: 200 with results array containing matching chunks with scores

**Step 5: Test listing and deletion**

```bash
# List indexes
curl http://localhost:8787/v1/indexes -H "X-Project-Key: <your-api-key>"

# List documents
curl http://localhost:8787/v1/indexes/<index-id>/documents -H "X-Project-Key: <your-api-key>"

# Delete document
curl -X DELETE http://localhost:8787/v1/indexes/<index-id>/documents/<doc-id> -H "X-Project-Key: <your-api-key>"

# Delete index
curl -X DELETE http://localhost:8787/v1/indexes/<index-id> -H "X-Project-Key: <your-api-key>"
```

**Step 6: Commit any fixes discovered during smoke testing**

---

## Task Summary

| Task | Description | Dependencies |
|------|-------------|--------------|
| 1 | Add shared types | None |
| 2 | Add database migration | None |
| 3 | Add database interface | Task 1 |
| 4 | Implement database methods | Task 3 |
| 5 | Add text chunker + tests | None |
| 6 | Add embedding client | None |
| 7 | Add FREE_AI_BASE_URL binding | None |
| 8 | Create routes + auth tests | Tasks 4, 5, 6, 7 |
| 9 | Run migration | Task 2 |
| 10 | End-to-end smoke test | Tasks 8, 9 |
