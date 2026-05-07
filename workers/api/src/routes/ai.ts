import { Hono } from 'hono';
import type { Context } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey, requireSession } from '../middleware/auth';
import { getDb } from '../db';
import {
  buildProviderEndpoint,
  decryptProviderKey,
  encryptProviderKey,
  extractUsageTokens,
  toPublicAIConfig,
  truncateProviderError,
  type StoredAIConfig,
} from '../ai-gateway';

const ai = new Hono<{ Bindings: Bindings; Variables: Variables }>();

type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;
type ProxyEndpoint = 'chat/completions' | 'embeddings';

interface UpdateAIConfigBody {
  ai_base_url?: unknown;
  ai_api_key?: unknown;
  ai_model?: unknown;
}

function parseProjectId(c: AppContext): string | null {
  const projectId = c.req.query('project_id');
  return projectId?.trim() || null;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseLimit(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function parseOffset(value: string | undefined): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

async function requireOwnedProject(c: AppContext, projectId: string) {
  const userId = c.get('userId')!;
  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);

  if (!project) {
    return { db, response: c.json({ error: 'Project not found' }, 404) };
  }

  if (project.owner_id !== userId) {
    return { db, response: c.json({ error: 'Forbidden' }, 403) };
  }

  return { db, project };
}

function readProviderModel(config: StoredAIConfig, body: Record<string, unknown>): string | null {
  if (typeof body.model === 'string' && body.model.trim()) {
    return body.model.trim();
  }
  return config.ai_model?.trim() || null;
}

async function readAIConfig(c: AppContext, db: ReturnType<typeof getDb>, projectId: string): Promise<StoredAIConfig> {
  const config = await db.getProjectAIConfig(projectId) as StoredAIConfig;
  return {
    ...config,
    ai_api_key: await decryptProviderKey(config.ai_api_key, c.env.AI_GATEWAY_KEY_SECRET),
  };
}

async function enforceAIProxyRateLimit(c: AppContext, endpoint: ProxyEndpoint): Promise<Response | null> {
  if (!c.env.RATE_LIMITER) return null;

  const projectId = c.get('projectId')!;
  const requestKey = c.req.header('X-Project-Key') || c.req.header('CF-Connecting-IP') || 'anonymous';
  const key = `ai:${projectId}:${endpoint}:${requestKey}`;

  try {
    const { success } = await c.env.RATE_LIMITER.limit({ key });
    if (!success) {
      return c.json({ error: 'AI Gateway rate limit exceeded' }, 429);
    }
  } catch (err) {
    console.error('AI Gateway rate limiter error:', err);
  }

  return null;
}

async function logAIRequest(
  db: ReturnType<typeof getDb>,
  params: {
    projectId: string;
    endpoint: ProxyEndpoint;
    model: string;
    status: 'success' | 'error' | 'timeout';
    latencyMs: number;
    inputTokens: number | null;
    outputTokens: number | null;
    errorMessage: string | null;
  },
): Promise<void> {
  await db.logAIRequest({
    id: crypto.randomUUID(),
    projectId: params.projectId,
    endpoint: params.endpoint,
    model: params.model,
    status: params.status,
    latencyMs: params.latencyMs,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    errorMessage: truncateProviderError(params.errorMessage),
  });
}

function upstreamHeaders(contentType: string | null, stream = false): Headers {
  const headers = new Headers();
  if (contentType) headers.set('Content-Type', contentType);
  if (stream) {
    headers.set('Cache-Control', 'no-cache');
  }
  return headers;
}

async function proxyAIRequest(c: AppContext, endpoint: ProxyEndpoint): Promise<Response> {
  const projectId = c.get('projectId')!;
  const rateLimitResponse = await enforceAIProxyRateLimit(c, endpoint);
  if (rateLimitResponse) return rateLimitResponse;

  const db = getDb(c.env.DB);
  const config = await readAIConfig(c, db, projectId);

  if (!config.ai_base_url || !config.ai_api_key || !config.ai_model) {
    return c.json({ error: 'AI provider is not configured for this project' }, 400);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await c.req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return c.json({ error: 'Request body must be a JSON object' }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return c.json({ error: 'Request body must be valid JSON' }, 400);
  }

  if (endpoint === 'chat/completions' && !Array.isArray(body.messages)) {
    return c.json({ error: 'messages is required' }, 400);
  }
  if (endpoint === 'embeddings' && body.input === undefined) {
    return c.json({ error: 'input is required' }, 400);
  }

  const model = readProviderModel(config, body);
  if (!model) return c.json({ error: 'model is required' }, 400);

  const upstreamBody = { ...body, model };
  const url = buildProviderEndpoint(config.ai_base_url, endpoint);
  const started = Date.now();

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai_api_key}`,
      },
      body: JSON.stringify(upstreamBody),
    });
  } catch (err) {
    const latencyMs = Date.now() - started;
    await logAIRequest(db, {
      projectId,
      endpoint,
      model,
      status: 'error',
      latencyMs,
      inputTokens: null,
      outputTokens: null,
      errorMessage: err instanceof Error ? err.message : 'Provider request failed',
    });
    return c.json({ error: 'AI provider request failed' }, 502);
  }

  const latencyMs = Date.now() - started;
  const contentType = upstream.headers.get('Content-Type');
  const isStreaming = upstream.ok && (body.stream === true || contentType?.includes('text/event-stream'));

  if (isStreaming) {
    await logAIRequest(db, {
      projectId,
      endpoint,
      model,
      status: 'success',
      latencyMs,
      inputTokens: null,
      outputTokens: null,
      errorMessage: null,
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: upstreamHeaders(contentType, true),
    });
  }

  const text = await upstream.text();
  let payload: unknown = null;
  if (contentType?.includes('application/json')) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  const usage = extractUsageTokens(payload);
  await logAIRequest(db, {
    projectId,
    endpoint,
    model,
    status: upstream.ok ? 'success' : 'error',
    latencyMs,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    errorMessage: upstream.ok ? null : text || `Provider returned ${upstream.status}`,
  });

  return new Response(text, {
    status: upstream.status,
    headers: upstreamHeaders(contentType),
  });
}

ai.get('/config', requireSession, async (c) => {
  const projectId = parseProjectId(c);
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const owned = await requireOwnedProject(c, projectId);
  if ('response' in owned) return owned.response;

  const config = await readAIConfig(c, owned.db, projectId);
  return c.json(toPublicAIConfig(config));
});

ai.put('/config', requireSession, async (c) => {
  const projectId = parseProjectId(c);
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const owned = await requireOwnedProject(c, projectId);
  if ('response' in owned) return owned.response;

  let body: UpdateAIConfigBody;
  try {
    body = await c.req.json() as UpdateAIConfigBody;
  } catch {
    return c.json({ error: 'Request body must be valid JSON' }, 400);
  }

  if (typeof body.ai_base_url !== 'string' || !body.ai_base_url.trim()) {
    return c.json({ error: 'ai_base_url is required' }, 400);
  }
  if (!isHttpUrl(body.ai_base_url.trim())) {
    return c.json({ error: 'ai_base_url must be an http(s) URL' }, 400);
  }
  if (typeof body.ai_model !== 'string' || !body.ai_model.trim()) {
    return c.json({ error: 'ai_model is required' }, 400);
  }
  if (body.ai_api_key !== undefined && body.ai_api_key !== null && typeof body.ai_api_key !== 'string') {
    return c.json({ error: 'ai_api_key must be a string when provided' }, 400);
  }

  const current = await owned.db.getProjectAIConfig(projectId) as StoredAIConfig;
  const nextApiKey = typeof body.ai_api_key === 'string' ? body.ai_api_key.trim() : '';
  if (!current.ai_api_key && !nextApiKey) {
    return c.json({ error: 'ai_api_key is required when no provider key is configured' }, 400);
  }

  await owned.db.updateProjectAIConfig(projectId, {
    ai_base_url: body.ai_base_url.trim().replace(/\/+$/, ''),
    ai_model: body.ai_model.trim(),
    ...(nextApiKey ? { ai_api_key: await encryptProviderKey(nextApiKey, c.env.AI_GATEWAY_KEY_SECRET) } : {}),
  });

  const config = await readAIConfig(c, owned.db, projectId);
  return c.json(toPublicAIConfig(config));
});

ai.delete('/config', requireSession, async (c) => {
  const projectId = parseProjectId(c);
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const owned = await requireOwnedProject(c, projectId);
  if ('response' in owned) return owned.response;

  await owned.db.deleteProjectAIConfig(projectId);
  return c.json({ ok: true });
});

ai.post('/chat/completions', requireApiKey, async (c) => proxyAIRequest(c, 'chat/completions'));
ai.post('/embeddings', requireApiKey, async (c) => proxyAIRequest(c, 'embeddings'));

ai.get('/usage', requireSession, async (c) => {
  const projectId = parseProjectId(c);
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const owned = await requireOwnedProject(c, projectId);
  if ('response' in owned) return owned.response;

  const days = parseLimit(c.req.query('days'), 30, 365);
  const stats = await owned.db.getAIUsageStats(projectId, days);
  return c.json(stats);
});

ai.get('/requests', requireSession, async (c) => {
  const projectId = parseProjectId(c);
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const owned = await requireOwnedProject(c, projectId);
  if ('response' in owned) return owned.response;

  const limit = parseLimit(c.req.query('limit'), 50, 100);
  const offset = parseOffset(c.req.query('offset'));
  const result = await owned.db.listAIRequests(projectId, limit, offset);
  return c.json({ ...result, limit, offset });
});

export { ai };
