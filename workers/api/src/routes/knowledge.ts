import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey, requireApiKeyOrSession, requireSession } from '../middleware/auth';
import { getDb } from '../db';
import type { 
  CreateIndexRequest, 
  IngestDocumentRequest, 
  SearchRequest,
  IndexRecord,
  DocumentRecord,
  SearchResult
} from '@saas-maker/shared-types';
import { capture } from '@saas-maker/ops';

const knowledge = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const MAX_DOC_SIZE = 100 * 1024; // 100KB
const PAGE_SIZE = 50;

// Chunker logic from design plan
function chunkText(text: string, size = 2000, overlap = 200): string[] {
  const chunks: string[] = [];
  if (!text) return chunks;

  const paragraphs = text.split('\n\n');
  let currentChunk = '';

  for (const p of paragraphs) {
    if ((currentChunk.length + p.length) <= size) {
      currentChunk += (currentChunk ? '\n\n' : '') + p;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      
      if (p.length > size) {
        let remaining = p;
        while (remaining.length > 0) {
          const chunk = remaining.slice(0, size);
          chunks.push(chunk);
          remaining = remaining.slice(size - overlap);
          if (remaining.length <= overlap) break;
        }
      } else {
        currentChunk = p;
      }
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

async function getEmbeddings(c: any, text: string | string[]): Promise<number[][]> {
  const inputs = Array.isArray(text) ? text : [text];
  
  if (c.env.AI) {
    const result = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', { text: inputs });
    return result.data as number[][];
  }
  throw new Error('AI binding not available for embeddings');
}

// --- Indexes ---

knowledge.post('/indexes', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const body = (await c.req.json()) as CreateIndexRequest & { project_id: string };
  if (!body.name?.trim()) return c.json({ error: 'Index name is required' }, 400);
  if (!body.project_id) return c.json({ error: 'project_id is required' }, 400);

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(body.project_id);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const index = await db.createIndex({
    id: crypto.randomUUID(),
    project_id: body.project_id,
    name: body.name.trim(),
    external_id: body.external_id || null,
  });

  capture({ distinctId: userId, event: 'knowledge_index_created', properties: { project_id: project.id, index_id: index.id } });
  return c.json(index, 201);
});

knowledge.get('/indexes', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const data = await db.listIndexesByProject(projectId);
  return c.json({ data });
});

knowledge.delete('/indexes/:id', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const indexId = c.req.param('id');
  const db = getDb(c.env.DB);

  const index = await db.getIndexById(indexId);
  if (!index) return c.json({ error: 'Not found' }, 404);

  const project = await db.getProjectById(index.project_id);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  await db.deleteIndex(indexId);
  capture({ distinctId: userId, event: 'knowledge_index_deleted', properties: { project_id: project.id, index_id: indexId } });
  return c.json({ ok: true });
});

// --- Documents ---

knowledge.post('/indexes/:id/documents', requireApiKeyOrSession, async (c) => {
  const db = getDb(c.env.DB);
  const indexId = c.req.param('id');
  const body = (await c.req.json()) as IngestDocumentRequest;

  let ownerId: string;
  let projectId: string;

  const apiKey = c.req.header('X-Project-Key');
  if (apiKey) {
    const project = c.get('project')!;
    projectId = project.id;
    ownerId = project.owner_id;
  } else {
    const userId = c.get('userId')!;
    ownerId = userId;
    const index = await db.getIndexById(indexId);
    if (!index) return c.json({ error: 'Index not found' }, 404);
    const project = await db.getProjectById(index.project_id);
    if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);
    projectId = project.id;
  }

  if (!body.content?.trim()) return c.json({ error: 'content is required' }, 400);
  if (body.content.length > MAX_DOC_SIZE) return c.json({ error: 'Content too large' }, 413);

  const index = await db.getIndexById(indexId);
  if (!index || index.project_id !== projectId) return c.json({ error: 'Index not found' }, 404);

  const doc = await db.createDocument({
    id: crypto.randomUUID(),
    index_id: indexId,
    content: body.content,
    metadata: body.metadata || {},
  });

  const chunks = chunkText(body.content);
  if (chunks.length > 0) {
    try {
      const vectors = await getEmbeddings(c, chunks);
      const chunkRecords = chunks.map((content, i) => ({
        id: crypto.randomUUID(),
        document_id: doc.id,
        index_id: indexId,
        content,
        embedding: vectors[i],
        chunk_index: i,
      }));
      await db.createChunks(chunkRecords);
    } catch (err: any) {
      console.error('Embedding error:', err);
      await db.deleteDocument(doc.id);
      return c.json({ error: `Failed to index document: ${err.message}` }, 502);
    }
  }

  capture({ distinctId: ownerId, event: 'knowledge_document_ingested', properties: { project_id: projectId, index_id: indexId, doc_id: doc.id, chunks: chunks.length } });
  return c.json({ ...doc, chunks_created: chunks.length }, 201);
});

knowledge.get('/indexes/:id/documents', requireApiKeyOrSession, async (c) => {
  const db = getDb(c.env.DB);
  const indexId = c.req.param('id');
  const page = parseInt(c.req.query('page') || '1', 10);

  const apiKey = c.req.header('X-Project-Key');
  if (apiKey) {
    const project = c.get('project')!;
    const index = await db.getIndexById(indexId);
    if (!index || index.project_id !== project.id) return c.json({ error: 'Index not found' }, 404);
  } else {
    const userId = c.get('userId')!;
    const index = await db.getIndexById(indexId);
    if (!index) return c.json({ error: 'Index not found' }, 404);
    const project = await db.getProjectById(index.project_id);
    if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);
  }

  const result = await db.listDocumentsByIndex(indexId, page, PAGE_SIZE);
  return c.json({ ...result, page, limit: PAGE_SIZE });
});

knowledge.delete('/documents/:id', requireApiKeyOrSession, async (c) => {
  const db = getDb(c.env.DB);
  const docId = c.req.param('id');

  const doc = await db.getDocumentById(docId);
  if (!doc) return c.json({ error: 'Not found' }, 404);

  let ownerId: string;
  const apiKey = c.req.header('X-Project-Key');
  if (apiKey) {
    const project = c.get('project')!;
    const index = await db.getIndexById(doc.index_id);
    if (!index || index.project_id !== project.id) return c.json({ error: 'Forbidden' }, 403);
    ownerId = project.owner_id;
  } else {
    const userId = c.get('userId')!;
    const index = await db.getIndexById(doc.index_id);
    if (!index) return c.json({ error: 'Index not found' }, 404);
    const project = await db.getProjectById(index.project_id);
    if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);
    ownerId = userId;
  }

  await db.deleteChunksByDocument(docId);
  await db.deleteDocument(docId);
  
  capture({ distinctId: ownerId, event: 'knowledge_document_deleted', properties: { doc_id: docId } });
  return c.json({ ok: true });
});

// --- Search ---

knowledge.post('/indexes/:id/search', requireApiKeyOrSession, async (c) => {
  const db = getDb(c.env.DB);
  const indexId = c.req.param('id');
  const body = (await c.req.json()) as SearchRequest;

  let ownerId: string;
  let projectId: string;

  const apiKey = c.req.header('X-Project-Key');
  if (apiKey) {
    const project = c.get('project')!;
    projectId = project.id;
    ownerId = project.owner_id;
  } else {
    const userId = c.get('userId')!;
    ownerId = userId;
    const index = await db.getIndexById(indexId);
    if (!index) return c.json({ error: 'Index not found' }, 404);
    const project = await db.getProjectById(index.project_id);
    if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);
    projectId = project.id;
  }

  if (!body.query?.trim()) return c.json({ error: 'query is required' }, 400);
  const topK = Math.min(Math.max(body.top_k || 5, 1), 20);

  try {
    const [queryVector] = await getEmbeddings(c, body.query);
    const results = await db.searchChunks(indexId, queryVector, topK);
    
    capture({ distinctId: ownerId, event: 'knowledge_search', properties: { project_id: projectId, index_id: indexId, query: body.query, results: results.length } });
    
    return c.json({ 
      data: results.map(r => ({
        document_id: r.document_id,
        chunk_content: r.content,
        score: r.score,
        metadata: r.metadata
      }))
    });
  } catch (err: any) {
    console.error('Search error:', err);
    return c.json({ error: `Search failed: ${err.message}` }, 502);
  }
});

export { knowledge };
