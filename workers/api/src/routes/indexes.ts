import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey, requireSession } from '../middleware/auth';
import { getDb } from '../db';
import { chunkText } from '../chunker';
import { getEmbeddings, EmbeddingError } from '../embeddings';
import type { CreateIndexRequest, IngestDocumentRequest, SearchRequest } from '@saas-maker/shared-types';

const indexes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const MAX_CONTENT_SIZE = 100 * 1024; // 100KB
const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 20;
const PAGE_SIZE = 20;

/** Supported embedding models and their dimensions. */
const SUPPORTED_MODELS: Record<string, { provider: string; dimensions: number; description: string }> = {
  // Voyage AI — v4 series
  'voyage-4-large': { provider: 'voyage', dimensions: 1024, description: 'Best quality, multilingual (1024d)' },
  'voyage-4': { provider: 'voyage', dimensions: 1024, description: 'General purpose (1024d)' },
  'voyage-4-lite': { provider: 'voyage', dimensions: 1024, description: 'Fast and cheap (1024d)' },
  // Voyage AI — specialized
  'voyage-code-3': { provider: 'voyage', dimensions: 1024, description: 'Code-optimized (1024d)' },
  'voyage-finance-2': { provider: 'voyage', dimensions: 1024, description: 'Finance domain (1024d)' },
  'voyage-law-2': { provider: 'voyage', dimensions: 1024, description: 'Legal domain (1024d)' },
  // Google Gemini
  'gemini-embedding-001': { provider: 'gemini', dimensions: 3072, description: 'Best quality, 100+ languages (3072d)' },
  // Cloudflare Workers AI
  '@cf/baai/bge-base-en-v1.5': { provider: 'cloudflare', dimensions: 768, description: 'Fast English (768d, free)' },
  '@cf/baai/bge-large-en-v1.5': { provider: 'cloudflare', dimensions: 1024, description: 'Quality English (1024d, free)' },
  '@cf/baai/bge-m3': { provider: 'cloudflare', dimensions: 1024, description: 'Multilingual, 100+ languages (1024d, free)' },
};

/** List available embedding models (no auth required). */
indexes.get('/models', (c) => {
  const models = Object.entries(SUPPORTED_MODELS).map(([id, meta]) => ({
    id,
    provider: meta.provider,
    dimensions: meta.dimensions,
    description: meta.description,
  }));
  return c.json({ models });
});

// --- Dashboard routes (session auth) - MUST be before wildcard requireApiKey ---

// Dashboard list indexes
indexes.get('/dashboard/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const data = await db.listIndexesByProject(projectId);
  return c.json({ data });
});

// Dashboard list documents in an index
indexes.get('/dashboard/:projectId/:indexId/documents', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const indexId = c.req.param('indexId');
  const page = parseInt(c.req.query('page') || '1', 10);

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const index = await db.getIndexById(indexId);
  if (!index) return c.json({ error: 'Index not found' }, 404);
  if (index.project_id !== projectId) return c.json({ error: 'Forbidden' }, 403);

  const result = await db.listDocumentsByIndex(indexId, page, PAGE_SIZE);
  return c.json({ data: result.data, total: result.total, page, limit: PAGE_SIZE });
});

// Dashboard: create index (session auth — project owner)
indexes.post('/dashboard/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const body = (await c.req.json()) as CreateIndexRequest;

  if (!body.name?.trim()) return c.json({ error: 'Index name is required' }, 400);

  if (!project.embedding_model && !body.embedding_model) {
    return c.json({ error: 'Project has no embedding model. Provide embedding_model.' }, 400);
  }

  if (body.embedding_model) {
    if (!SUPPORTED_MODELS[body.embedding_model]) {
      return c.json({ error: `Unsupported model: ${body.embedding_model}` }, 400);
    }
    if (!project.embedding_model) {
      await db.updateProject(projectId, { embedding_model: body.embedding_model });
    }
  }

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

// All routes below require API key
indexes.use('*', requireApiKey);

/**
 * Get the embedding model for a project.
 * If the project has no model yet, `requestedModel` must be provided (first use).
 * Returns the locked model string or null if no model and none requested.
 */
async function getProjectModel(
  projectId: string,
  databaseUrl: string,
  requestedModel?: string
): Promise<{ model: string } | { error: string; status: number }> {
  const db = getDb(databaseUrl);
  const project = await db.getProjectById(projectId);
  if (!project) return { error: 'Project not found', status: 404 };

  if (project.embedding_model) return { model: project.embedding_model };

  // First vector operation — need a model from the user
  if (!requestedModel) {
    return { error: 'Project has no embedding model set. Provide embedding_model in your first index creation request.', status: 400 };
  }

  if (!SUPPORTED_MODELS[requestedModel]) {
    return { error: `Unsupported model: ${requestedModel}. Use GET /v1/indexes/models for available models.`, status: 400 };
  }

  await db.updateProject(projectId, { embedding_model: requestedModel });
  return { model: requestedModel };
}

// --- Index CRUD ---

indexes.post('/', async (c) => {
  const projectId = c.get('projectId')!;
  const body = (await c.req.json()) as CreateIndexRequest;

  if (!body.name?.trim()) return c.json({ error: 'Index name is required' }, 400);

  // Validate embedding_model if provided
  if (body.embedding_model && !SUPPORTED_MODELS[body.embedding_model]) {
    return c.json({ error: `Unsupported model: ${body.embedding_model}. Use GET /v1/indexes/models for available models.` }, 400);
  }

  // Lock the model on first vector use (or validate it's already set)
  const result = await getProjectModel(projectId, c.env.DATABASE_URL, body.embedding_model);
  if ('error' in result) return c.json({ error: result.error }, result.status as any);

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

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
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const data = await db.listIndexesByProject(projectId);
  return c.json({ data });
});

indexes.delete('/:indexId', async (c) => {
  const projectId = c.get('projectId')!;
  const indexId = c.req.param('indexId');
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

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

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  const index = await db.getIndexById(indexId);
  if (!index) return c.json({ error: 'Index not found' }, 404);
  if (index.project_id !== projectId) return c.json({ error: 'Forbidden' }, 403);

  // Get the project's locked embedding model
  const modelResult = await getProjectModel(projectId, c.env.DATABASE_URL);
  if ('error' in modelResult) return c.json({ error: modelResult.error }, modelResult.status as any);
  const model = modelResult.model;

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
        ai: c.env.AI,
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

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

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

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

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

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  const index = await db.getIndexById(indexId);
  if (!index) return c.json({ error: 'Index not found' }, 404);
  if (index.project_id !== projectId) return c.json({ error: 'Forbidden' }, 403);

  // Use the project's locked model
  const modelResult = await getProjectModel(projectId, c.env.DATABASE_URL);
  if ('error' in modelResult) return c.json({ error: modelResult.error }, modelResult.status as any);
  const model = modelResult.model;

  try {
    const [queryEmbedding] = await getEmbeddings({
      baseUrl: c.env.FREE_AI_BASE_URL,
      apiKey: c.env.FREE_AI_API_KEY,
      model,
      projectId,
      ai: c.env.AI,
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
