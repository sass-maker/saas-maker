import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey } from '../middleware/auth';
import { getDb } from '../db';
import { chunkText } from '../chunker';
import { getEmbeddings } from '../embeddings';
import type { CreateIndexRequest, IngestDocumentRequest, SearchRequest } from '@saasmaker/shared-types';

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
