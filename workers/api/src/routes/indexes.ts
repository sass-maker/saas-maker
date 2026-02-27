import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey } from '../middleware/auth';
import { getDb } from '../db';
import { chunkText } from '../chunker';
import { getEmbeddings, EmbeddingError } from '../embeddings';
import type { CreateIndexRequest, IngestDocumentRequest, SearchRequest } from '@saasmaker/shared-types';

const indexes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

indexes.use('*', requireApiKey);

const MAX_CONTENT_SIZE = 100 * 1024; // 100KB
const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 20;
const PAGE_SIZE = 20;

/** Get the embedding model for a project, locking it on first use. */
async function getProjectModel(
  projectId: string,
  defaultModel: string,
  databaseUrl: string
): Promise<string> {
  const db = getDb(databaseUrl);
  const project = await db.getProjectById(projectId);
  if (!project) throw new Error('Project not found');

  if (project.embedding_model) return project.embedding_model;

  // First vector operation — lock the model
  await db.updateProject(projectId, { embedding_model: defaultModel });
  return defaultModel;
}

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

  // Lock embedding model on first use
  const model = await getProjectModel(projectId, c.env.FREE_AI_EMBEDDING_MODEL || 'voyage-3.5-lite', c.env.DATABASE_URL);

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
    try {
      const embeddings = await getEmbeddings({
        baseUrl: c.env.FREE_AI_BASE_URL,
        apiKey: c.env.FREE_AI_API_KEY,
        model,
        projectId,
      }, textChunks);

      const chunkRecords = textChunks.map((text, i) => ({
        id: crypto.randomUUID(),
        document_id: docId,
        index_id: indexId,
        content: text,
        embedding: embeddings[i],
        chunk_index: i,
      }));

      await db.createChunks(chunkRecords);
    } catch (e) {
      // Clean up the document if embedding fails
      await db.deleteDocument(docId);
      if (e instanceof EmbeddingError) {
        return c.json({ error: `Embedding service unavailable: ${e.message}` }, 502);
      }
      throw e;
    }
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

  // Use the project's locked model
  const model = await getProjectModel(projectId, c.env.FREE_AI_EMBEDDING_MODEL || 'voyage-3.5-lite', c.env.DATABASE_URL);

  try {
    const [queryEmbedding] = await getEmbeddings({
      baseUrl: c.env.FREE_AI_BASE_URL,
      apiKey: c.env.FREE_AI_API_KEY,
      model,
      projectId,
    }, [body.query]);

    const raw = await db.searchChunks(indexId, queryEmbedding, topK);
    const results = raw.map(r => ({
      document_id: r.document_id,
      chunk_content: r.content,
      score: r.score,
      metadata: r.metadata,
    }));

    return c.json({ results });
  } catch (e) {
    if (e instanceof EmbeddingError) {
      return c.json({ error: `Embedding service unavailable: ${e.message}` }, 502);
    }
    throw e;
  }
});

export { indexes };
