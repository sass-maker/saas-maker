import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireSession, requireApiKey } from '../middleware/auth';
import { getDb } from '../db';
import { chatCompletion, embeddings, parseUsage, LLMConfig } from '../llm';
import { getEmbeddings } from '../embeddings';

const aiGateway = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ── Helpers ──────────────────────────────────────────────────────────────────

function maskApiKey(key: string): string {
  if (key.length <= 11) return '***';
  return key.slice(0, 7) + '...' + key.slice(-4);
}

function resolveConfig(
  projectConfig: { ai_base_url: string | null; ai_api_key: string | null; ai_model: string | null },
  env: Bindings,
): LLMConfig | null {
  if (projectConfig.ai_base_url && projectConfig.ai_api_key && projectConfig.ai_model) {
    return {
      baseUrl: projectConfig.ai_base_url,
      apiKey: projectConfig.ai_api_key,
      model: projectConfig.ai_model,
    };
  }
  if (env.FREE_AI_BASE_URL && env.FREE_AI_API_KEY) {
    return {
      baseUrl: env.FREE_AI_BASE_URL,
      apiKey: env.FREE_AI_API_KEY,
      model: 'gpt-4o-mini',
    };
  }
  return null;
}

// ── Config CRUD (requireSession) ─────────────────────────────────────────────

aiGateway.get('/config/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const config = await db.getProjectAIConfig(projectId);

  return c.json({
    ai_base_url: config.ai_base_url,
    ai_api_key: config.ai_api_key ? maskApiKey(config.ai_api_key) : null,
    ai_model: config.ai_model,
  });
});

aiGateway.put('/config/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const body = (await c.req.json()) as {
    ai_base_url: string;
    ai_api_key: string;
    ai_model: string;
  };

  if (!body.ai_base_url?.trim() || !body.ai_api_key?.trim() || !body.ai_model?.trim()) {
    return c.json({ error: 'ai_base_url, ai_api_key, and ai_model are required' }, 400);
  }

  await db.updateProjectAIConfig(projectId, {
    ai_base_url: body.ai_base_url.trim(),
    ai_api_key: body.ai_api_key.trim(),
    ai_model: body.ai_model.trim(),
  });

  return c.json({ ok: true });
});

aiGateway.delete('/config/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  await db.deleteProjectAIConfig(projectId);

  return c.json({ ok: true });
});

// ── Usage (requireSession) ───────────────────────────────────────────────────

aiGateway.get('/usage/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const days = parseInt(c.req.query('days') || '30', 10);

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const stats = await db.getAIUsageStats(projectId, days);
  return c.json(stats);
});

aiGateway.get('/requests/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const result = await db.listAIRequests(projectId, limit, offset);
  return c.json(result);
});

// ── Proxy (requireApiKey) ────────────────────────────────────────────────────

aiGateway.post('/chat/completions', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  const projectConfig = await db.getProjectAIConfig(projectId);
  const config = resolveConfig(projectConfig, c.env);
  if (!config) return c.json({ error: 'AI not configured for this project' }, 400);

  const body = await c.req.json();
  const model = body.model || config.model;
  const startTime = Date.now();

  const response = await chatCompletion({
    config: { ...config, model },
    messages: body.messages,
    stream: body.stream,
    temperature: body.temperature,
    max_tokens: body.max_tokens,
  });

  // Fire-and-forget usage logging for non-streaming responses
  if (!body.stream) {
    const cloned = response.clone();
    cloned.json().then((data: any) => {
      const usage = parseUsage(data);
      db.logAIRequest({
        id: crypto.randomUUID(),
        projectId,
        endpoint: '/chat/completions',
        model,
        status: 'success',
        latencyMs: Date.now() - startTime,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        errorMessage: null,
      }).catch(() => {});
    }).catch(() => {});
  } else {
    // Log streaming requests without token counts
    db.logAIRequest({
      id: crypto.randomUUID(),
      projectId,
      endpoint: '/chat/completions',
      model,
      status: response.ok ? 'success' : 'error',
      latencyMs: Date.now() - startTime,
      inputTokens: null,
      outputTokens: null,
      errorMessage: response.ok ? null : `HTTP ${response.status}`,
    }).catch(() => {});
  }

  // Pass through the response body (supports SSE streaming)
  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
    },
  });
});

aiGateway.post('/embeddings', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  const projectConfig = await db.getProjectAIConfig(projectId);
  const config = resolveConfig(projectConfig, c.env);
  if (!config) return c.json({ error: 'AI not configured for this project' }, 400);

  const body = await c.req.json();
  const model = body.model || config.model;
  const startTime = Date.now();

  const response = await embeddings(config, body.input, model);

  // Fire-and-forget usage logging
  const cloned = response.clone();
  cloned.json().then((data: any) => {
    const usage = parseUsage(data);
    db.logAIRequest({
      id: crypto.randomUUID(),
      projectId,
      endpoint: '/embeddings',
      model,
      status: 'success',
      latencyMs: Date.now() - startTime,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      errorMessage: null,
    }).catch(() => {});
  }).catch(() => {});

  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
    },
  });
});

// ── RAG (requireApiKey) ──────────────────────────────────────────────────────

aiGateway.post('/rag', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  const projectConfig = await db.getProjectAIConfig(projectId);
  const config = resolveConfig(projectConfig, c.env);
  if (!config) return c.json({ error: 'AI not configured for this project' }, 400);

  const body = (await c.req.json()) as {
    query: string;
    index_id: string;
    top_k?: number;
    system_prompt?: string;
    stream?: boolean;
  };

  if (!body.query?.trim()) return c.json({ error: 'query is required' }, 400);
  if (!body.index_id?.trim()) return c.json({ error: 'index_id is required' }, 400);

  const topK = body.top_k ?? 5;

  // 1. Embed the query — use project's embedding model via AI binding
  const project = await db.getProjectById(projectId);
  const embeddingModel = project?.embedding_model;
  if (!embeddingModel) {
    return c.json({ error: 'No embedding model configured for this project' }, 400);
  }

  let queryEmbedding: number[];
  try {
    const [emb] = await getEmbeddings({
      baseUrl: c.env.FREE_AI_BASE_URL,
      apiKey: c.env.FREE_AI_API_KEY,
      model: embeddingModel,
      projectId,
      ai: c.env.AI,
    }, [body.query]);
    queryEmbedding = emb;
  } catch (e) {
    return c.json({ error: 'Failed to generate query embedding' }, 502);
  }

  // 2. Vector search
  const chunks = await db.searchChunks(body.index_id, queryEmbedding, topK);

  // 3. Build context and call chat completion
  const context = chunks.map((ch) => ch.content).join('\n\n---\n\n');
  const systemPrompt =
    body.system_prompt ||
    'You are a helpful assistant. Answer the user\'s question based on the provided context. If the context does not contain relevant information, say so.';

  const messages = [
    { role: 'system', content: `${systemPrompt}\n\nContext:\n${context}` },
    { role: 'user', content: body.query },
  ];

  const startTime = Date.now();
  const response = await chatCompletion({
    config,
    messages,
    stream: body.stream,
  });

  // Fire-and-forget usage logging
  if (!body.stream) {
    const cloned = response.clone();
    cloned.json().then((data: any) => {
      const usage = parseUsage(data);
      db.logAIRequest({
        id: crypto.randomUUID(),
        projectId,
        endpoint: '/rag',
        model: config.model,
        status: 'success',
        latencyMs: Date.now() - startTime,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        errorMessage: null,
      }).catch(() => {});
    }).catch(() => {});
  } else {
    db.logAIRequest({
      id: crypto.randomUUID(),
      projectId,
      endpoint: '/rag',
      model: config.model,
      status: response.ok ? 'success' : 'error',
      latencyMs: Date.now() - startTime,
      inputTokens: null,
      outputTokens: null,
      errorMessage: response.ok ? null : `HTTP ${response.status}`,
    }).catch(() => {});
  }

  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
    },
  });
});

export { aiGateway };
