# AI Gateway + Chat Completions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a BYOK AI Gateway service to saas-maker — users configure their own AI provider (base_url + api_key + model), saas-maker proxies requests and tracks usage.

**Architecture:** Three new columns on `projects` table for AI config. New `ai_requests` table for usage tracking. New route file `ai-gateway.ts` with config CRUD, chat/completions proxy (SSE streaming), embeddings proxy, and usage endpoints. New `llm.ts` for the universal OpenAI-format caller. SDK gets `AIGatewayService`.

**Tech Stack:** Hono (CF Workers), PostgreSQL (Hyperdrive), OpenAI-compatible API format, SSE streaming

---

### Task 1: Database Migration

**Files:**
- Create: `packages/db/migrations/0011_ai_gateway.sql`

**Step 1: Write migration**

```sql
-- AI Gateway: provider config on projects + request logging

ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_base_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_api_key TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_model TEXT;

CREATE TABLE IF NOT EXISTS ai_requests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout')),
  latency_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_requests_project_date ON ai_requests(project_id, created_at DESC);
```

**Step 2: Apply locally**

Run: `cockroach sql --insecure < packages/db/migrations/0011_ai_gateway.sql`
Expected: `ALTER TABLE` + `CREATE TABLE` + `CREATE INDEX` success

**Step 3: Commit**

```bash
git add packages/db/migrations/0011_ai_gateway.sql
git commit -m "feat: add AI gateway migration (projects columns + ai_requests table)"
```

---

### Task 2: Shared Types

**Files:**
- Modify: `packages/shared-types/src/index.ts`

**Step 1: Add AI types at end of file**

```typescript
// ── AI Gateway ────────────────────────────────────────────────────────────────

export interface AIProviderConfig {
  ai_base_url: string | null;
  ai_api_key: string | null;
  ai_model: string | null;
}

export interface UpdateAIConfigRequest {
  ai_base_url: string;
  ai_api_key: string;
  ai_model: string;
}

export interface AIRequestRecord {
  id: string;
  project_id: string;
  endpoint: string;
  model: string;
  status: 'success' | 'error' | 'timeout';
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  error_message: string | null;
  created_at: string;
}

export interface AIUsageStats {
  total_requests: number;
  success_count: number;
  error_count: number;
  avg_latency_ms: number | null;
  total_input_tokens: number;
  total_output_tokens: number;
}

export interface AIChatCompletionRequest {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface AIEmbeddingRequest {
  input: string | string[];
  model?: string;
}

export interface AIRagRequest {
  index_id: string;
  query: string;
  system_prompt?: string;
  top_k?: number;
  stream?: boolean;
}

export interface AIRagResponse {
  response: string;
  sources: Array<{ document_id: string; chunk_content: string; score: number }>;
  usage: { input_tokens: number; output_tokens: number };
}
```

**Step 2: Build types**

Run: `pnpm -F @saas-maker/shared-types build`
Expected: Build success

**Step 3: Commit**

```bash
git add packages/shared-types/src/index.ts
git commit -m "feat: add AI gateway shared types"
```

---

### Task 3: Database Queries

**Files:**
- Modify: `workers/api/src/db.ts`

**Step 1: Add AI config + usage query methods**

Add these methods to the database object (after the changelog methods, before the return statement):

```typescript
    // ── AI Gateway ──────────────────────────────────────────────────────────

    async getProjectAIConfig(projectId: string): Promise<{ ai_base_url: string | null; ai_api_key: string | null; ai_model: string | null }> {
      const result = await sql`SELECT ai_base_url, ai_api_key, ai_model FROM projects WHERE id = ${projectId}`;
      const row = result.rows[0];
      if (!row) throw new Error('Project not found');
      return { ai_base_url: row.ai_base_url, ai_api_key: row.ai_api_key, ai_model: row.ai_model };
    },

    async updateProjectAIConfig(projectId: string, config: { ai_base_url: string; ai_api_key: string; ai_model: string }): Promise<void> {
      await sql`UPDATE projects SET ai_base_url = ${config.ai_base_url}, ai_api_key = ${config.ai_api_key}, ai_model = ${config.ai_model}, updated_at = now() WHERE id = ${projectId}`;
    },

    async deleteProjectAIConfig(projectId: string): Promise<void> {
      await sql`UPDATE projects SET ai_base_url = NULL, ai_api_key = NULL, ai_model = NULL, updated_at = now() WHERE id = ${projectId}`;
    },

    async logAIRequest(params: {
      id: string;
      projectId: string;
      endpoint: string;
      model: string;
      status: 'success' | 'error' | 'timeout';
      latencyMs: number | null;
      inputTokens: number | null;
      outputTokens: number | null;
      errorMessage: string | null;
    }): Promise<void> {
      await sql`INSERT INTO ai_requests (id, project_id, endpoint, model, status, latency_ms, input_tokens, output_tokens, error_message) VALUES (${params.id}, ${params.projectId}, ${params.endpoint}, ${params.model}, ${params.status}, ${params.latencyMs}, ${params.inputTokens}, ${params.outputTokens}, ${params.errorMessage})`;
    },

    async getAIUsageStats(projectId: string, daysBack: number = 30): Promise<{ total_requests: number; success_count: number; error_count: number; avg_latency_ms: number | null; total_input_tokens: number; total_output_tokens: number }> {
      const result = await sql`SELECT COUNT(*)::int AS total_requests, COUNT(*) FILTER (WHERE status = 'success')::int AS success_count, COUNT(*) FILTER (WHERE status = 'error')::int AS error_count, AVG(latency_ms)::int AS avg_latency_ms, COALESCE(SUM(input_tokens), 0)::int AS total_input_tokens, COALESCE(SUM(output_tokens), 0)::int AS total_output_tokens FROM ai_requests WHERE project_id = ${projectId} AND created_at > now() - make_interval(days => ${daysBack})`;
      return result.rows[0] as any;
    },

    async listAIRequests(projectId: string, limit: number = 50, offset: number = 0): Promise<{ data: any[]; total: number }> {
      const countResult = await sql`SELECT COUNT(*)::int AS total FROM ai_requests WHERE project_id = ${projectId}`;
      const result = await sql`SELECT * FROM ai_requests WHERE project_id = ${projectId} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      return { data: result.rows, total: countResult.rows[0].total };
    },
```

**Step 2: Commit**

```bash
git add workers/api/src/db.ts
git commit -m "feat: add AI gateway database queries"
```

---

### Task 4: LLM Provider Abstraction

**Files:**
- Create: `workers/api/src/llm.ts`

**Step 1: Write the LLM caller**

```typescript
export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatOptions {
  config: LLMConfig;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface ChatResult {
  content: string;
  usage: { input_tokens: number; output_tokens: number };
}

/**
 * Universal OpenAI-compatible chat completion caller.
 * Works with OpenAI, Anthropic (compat), Groq, Gemini, OpenRouter, free-ai, etc.
 */
export async function chatCompletion(options: ChatOptions): Promise<Response> {
  const { config, messages, stream = false, temperature, max_tokens } = options;

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    stream,
  };
  if (temperature !== undefined) body.temperature = temperature;
  if (max_tokens !== undefined) body.max_tokens = max_tokens;

  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  return response;
}

export async function embeddings(
  config: LLMConfig,
  input: string | string[],
  model?: string,
): Promise<Response> {
  const url = `${config.baseUrl.replace(/\/+$/, '')}/embeddings`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: model || config.model,
      input,
    }),
  });

  return response;
}

/**
 * Parse usage from an OpenAI-format non-streaming response.
 */
export function parseUsage(data: any): { input_tokens: number; output_tokens: number } {
  const usage = data?.usage;
  return {
    input_tokens: usage?.prompt_tokens ?? usage?.input_tokens ?? 0,
    output_tokens: usage?.completion_tokens ?? usage?.output_tokens ?? 0,
  };
}
```

**Step 2: Commit**

```bash
git add workers/api/src/llm.ts
git commit -m "feat: add universal OpenAI-compatible LLM caller"
```

---

### Task 5: AI Gateway Routes

**Files:**
- Create: `workers/api/src/routes/ai-gateway.ts`
- Modify: `workers/api/src/index.ts`

**Step 1: Write route file**

```typescript
import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireSession, requireApiKey } from '../middleware/auth';
import { getDb } from '../db';
import { chatCompletion, embeddings, parseUsage, LLMConfig } from '../llm';

export const aiGateway = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ── Config CRUD (dashboard auth) ────────────────────────────────────────────

aiGateway.get('/config/:projectId', requireSession, async (c) => {
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const projectId = c.req.param('projectId');

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== c.get('userId')) {
    return c.json({ error: 'Not found' }, 404);
  }

  const config = await db.getProjectAIConfig(projectId);
  return c.json({
    ai_base_url: config.ai_base_url,
    ai_api_key: config.ai_api_key ? `${config.ai_api_key.slice(0, 7)}...${config.ai_api_key.slice(-4)}` : null,
    ai_model: config.ai_model,
    configured: !!(config.ai_base_url && config.ai_api_key && config.ai_model),
  });
});

aiGateway.put('/config/:projectId', requireSession, async (c) => {
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const projectId = c.req.param('projectId');

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== c.get('userId')) {
    return c.json({ error: 'Not found' }, 404);
  }

  const body = await c.req.json<{ ai_base_url: string; ai_api_key: string; ai_model: string }>();
  if (!body.ai_base_url || !body.ai_api_key || !body.ai_model) {
    return c.json({ error: 'ai_base_url, ai_api_key, and ai_model are required' }, 400);
  }

  await db.updateProjectAIConfig(projectId, body);
  return c.json({ ok: true });
});

aiGateway.delete('/config/:projectId', requireSession, async (c) => {
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const projectId = c.req.param('projectId');

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== c.get('userId')) {
    return c.json({ error: 'Not found' }, 404);
  }

  await db.deleteProjectAIConfig(projectId);
  return c.json({ ok: true });
});

// ── Usage (dashboard auth) ──────────────────────────────────────────────────

aiGateway.get('/usage/:projectId', requireSession, async (c) => {
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const projectId = c.req.param('projectId');
  const days = Number(c.req.query('days') || '30');

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== c.get('userId')) {
    return c.json({ error: 'Not found' }, 404);
  }

  const stats = await db.getAIUsageStats(projectId, days);
  return c.json(stats);
});

aiGateway.get('/requests/:projectId', requireSession, async (c) => {
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const projectId = c.req.param('projectId');
  const limit = Math.min(Number(c.req.query('limit') || '50'), 100);
  const offset = Number(c.req.query('offset') || '0');

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== c.get('userId')) {
    return c.json({ error: 'Not found' }, 404);
  }

  const result = await db.listAIRequests(projectId, limit, offset);
  return c.json(result);
});

// ── Proxy helpers ───────────────────────────────────────────────────────────

async function getProjectLLMConfig(env: Bindings, projectId: string): Promise<LLMConfig | null> {
  const db = getDb(env.DATABASE_URL, env.HYPERDRIVE);
  const config = await db.getProjectAIConfig(projectId);
  if (!config.ai_base_url || !config.ai_api_key || !config.ai_model) return null;
  return { baseUrl: config.ai_base_url, apiKey: config.ai_api_key, model: config.ai_model };
}

async function logRequest(
  env: Bindings,
  projectId: string,
  endpoint: string,
  model: string,
  startTime: number,
  response: Response,
  errorMessage?: string,
) {
  const db = getDb(env.DATABASE_URL, env.HYPERDRIVE);
  const latencyMs = Date.now() - startTime;
  const status = response.ok ? 'success' : 'error';

  let inputTokens: number | null = null;
  let outputTokens: number | null = null;

  // Try to parse usage from non-streaming responses
  if (response.ok && !response.headers.get('content-type')?.includes('text/event-stream')) {
    try {
      const clone = response.clone();
      const data = await clone.json();
      const usage = parseUsage(data);
      inputTokens = usage.input_tokens;
      outputTokens = usage.output_tokens;
    } catch { /* ignore parse failures */ }
  }

  // Fire and forget — don't block the response
  db.logAIRequest({
    id: crypto.randomUUID(),
    projectId,
    endpoint,
    model,
    status: status as 'success' | 'error',
    latencyMs,
    inputTokens,
    outputTokens,
    errorMessage: errorMessage || (response.ok ? null : `HTTP ${response.status}`),
  }).catch(() => {});
}

// ── Chat Completions Proxy (API key auth) ───────────────────────────────────

aiGateway.post('/chat/completions', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const llmConfig = await getProjectLLMConfig(c.env, projectId);
  if (!llmConfig) return c.json({ error: 'AI provider not configured for this project' }, 400);

  const body = await c.req.json();
  const model = body.model || llmConfig.model;
  const startTime = Date.now();

  const providerResponse = await chatCompletion({
    config: { ...llmConfig, model },
    messages: body.messages,
    stream: body.stream,
    temperature: body.temperature,
    max_tokens: body.max_tokens,
  });

  // Log usage (non-blocking)
  logRequest(c.env, projectId, 'chat/completions', model, startTime, providerResponse);

  // Stream through the provider response
  return new Response(providerResponse.body, {
    status: providerResponse.status,
    headers: {
      'Content-Type': providerResponse.headers.get('Content-Type') || 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
});

// ── Embeddings Proxy (API key auth) ─────────────────────────────────────────

aiGateway.post('/embeddings', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const llmConfig = await getProjectLLMConfig(c.env, projectId);
  if (!llmConfig) return c.json({ error: 'AI provider not configured for this project' }, 400);

  const body = await c.req.json();
  const model = body.model || llmConfig.model;
  const startTime = Date.now();

  const providerResponse = await embeddings(llmConfig, body.input, model);

  logRequest(c.env, projectId, 'embeddings', model, startTime, providerResponse);

  return new Response(providerResponse.body, {
    status: providerResponse.status,
    headers: {
      'Content-Type': providerResponse.headers.get('Content-Type') || 'application/json',
    },
  });
});

// ── RAG Chat (API key auth) ─────────────────────────────────────────────────

aiGateway.post('/rag', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const llmConfig = await getProjectLLMConfig(c.env, projectId);
  if (!llmConfig) return c.json({ error: 'AI provider not configured for this project' }, 400);

  const body = await c.req.json<{
    index_id: string;
    query: string;
    system_prompt?: string;
    top_k?: number;
    stream?: boolean;
  }>();

  if (!body.index_id || !body.query) {
    return c.json({ error: 'index_id and query are required' }, 400);
  }

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const topK = body.top_k || 5;

  // 1. Embed the query
  const embeddingResponse = await embeddings(llmConfig, body.query);
  if (!embeddingResponse.ok) {
    return c.json({ error: 'Failed to generate query embedding' }, 502);
  }
  const embeddingData = await embeddingResponse.json() as { data: { embedding: number[] }[] };
  const queryEmbedding = embeddingData.data[0].embedding;

  // 2. Search chunks
  const chunks = await db.searchChunks(body.index_id, queryEmbedding, topK);

  // 3. Build prompt
  const contextBlocks = chunks
    .map((chunk: any) => `---\n${chunk.content}\n---`)
    .join('\n\n');

  const systemPrompt = body.system_prompt ||
    'You are a helpful assistant. Answer questions based only on the provided context.';

  const messages = [
    {
      role: 'system',
      content: `${systemPrompt}\n\nHere is the relevant context:\n\n${contextBlocks}`,
    },
    { role: 'user', content: body.query },
  ];

  // 4. Call LLM
  const startTime = Date.now();
  const providerResponse = await chatCompletion({
    config: llmConfig,
    messages,
    stream: body.stream || false,
  });

  logRequest(c.env, projectId, 'rag', llmConfig.model, startTime, providerResponse);

  if (body.stream) {
    return new Response(providerResponse.body, {
      status: providerResponse.status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  }

  // Non-streaming: parse and add sources
  if (!providerResponse.ok) {
    const errText = await providerResponse.text();
    return c.json({ error: `AI provider error: ${errText}` }, 502);
  }

  const data = await providerResponse.json() as any;
  const usage = parseUsage(data);
  const responseText = data.choices?.[0]?.message?.content || '';

  return c.json({
    response: responseText,
    sources: chunks.map((chunk: any) => ({
      document_id: chunk.document_id,
      chunk_content: chunk.content,
      score: chunk.score,
    })),
    usage,
  });
});
```

**Step 2: Register routes in index.ts**

Add import and route registration in `workers/api/src/index.ts`:

```typescript
// Add to imports:
import { aiGateway } from './routes/ai-gateway';

// Add after the forms route:
app.route('/v1/ai', aiGateway);
```

**Step 3: Commit**

```bash
git add workers/api/src/routes/ai-gateway.ts workers/api/src/index.ts
git commit -m "feat: add AI gateway routes (config, proxy, RAG, usage)"
```

---

### Task 6: SDK Service

**Files:**
- Create: `packages/sdk/src/services/ai-gateway.ts`
- Modify: `packages/sdk/src/client.ts`

**Step 1: Write SDK service**

```typescript
import { HttpClient } from '../http';

export interface AIChatMessage {
  role: string;
  content: string;
}

export interface AIChatOptions {
  messages: AIChatMessage[];
  model?: string;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface AIRagOptions {
  index_id: string;
  query: string;
  system_prompt?: string;
  top_k?: number;
  stream?: boolean;
}

export interface AIRagResponse {
  response: string;
  sources: Array<{ document_id: string; chunk_content: string; score: number }>;
  usage: { input_tokens: number; output_tokens: number };
}

export class AIGatewayService {
  constructor(private http: HttpClient) {}

  /** Proxy chat completion to configured provider (POST /v1/ai/chat/completions). */
  chat(options: AIChatOptions): Promise<any> {
    return this.http.request<any>('POST', '/v1/ai/chat/completions', options);
  }

  /** Proxy embedding to configured provider (POST /v1/ai/embeddings). */
  embed(input: string | string[], model?: string): Promise<any> {
    return this.http.request<any>('POST', '/v1/ai/embeddings', { input, model });
  }

  /** RAG-enhanced chat (POST /v1/ai/rag). */
  rag(options: AIRagOptions): Promise<AIRagResponse> {
    return this.http.request<AIRagResponse>('POST', '/v1/ai/rag', options);
  }
}
```

**Step 2: Wire into client**

In `packages/sdk/src/client.ts`, add:

```typescript
// Add import:
import { AIGatewayService } from './services/ai-gateway';

// Add property in class:
readonly ai: AIGatewayService;

// Add in constructor after forms:
this.ai = new AIGatewayService(http);
```

**Step 3: Build SDK**

Run: `pnpm -F @saas-maker/sdk build`
Expected: Build success

**Step 4: Commit**

```bash
git add packages/sdk/src/services/ai-gateway.ts packages/sdk/src/client.ts
git commit -m "feat: add AI gateway SDK service"
```

---

### Task 7: Type-check and Integration Test

**Step 1: Build all packages**

Run: `pnpm build:types && pnpm build:db`
Expected: Build success

**Step 2: Type-check API worker**

Run: `cd workers/api && pnpm exec tsc --noEmit`
Expected: No type errors

**Step 3: Start dev server and test**

Run: `cd workers/api && pnpm dev`

Test config endpoint:
```bash
curl -X PUT http://localhost:8787/v1/ai/config/{PROJECT_ID} \
  -H "Authorization: Bearer {SESSION_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"ai_base_url":"https://api.groq.com/openai/v1","ai_api_key":"test-key","ai_model":"llama-3.3-70b-versatile"}'
```

Test proxy endpoint:
```bash
curl -X POST http://localhost:8787/v1/ai/chat/completions \
  -H "X-Project-Key: pk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: AI gateway service complete — config, proxy, RAG, usage, SDK"
```

---

## File Changes Summary

| File | Action |
|------|--------|
| `packages/db/migrations/0011_ai_gateway.sql` | Create |
| `packages/shared-types/src/index.ts` | Modify (add AI types) |
| `workers/api/src/db.ts` | Modify (add 5 query methods) |
| `workers/api/src/llm.ts` | Create |
| `workers/api/src/routes/ai-gateway.ts` | Create |
| `workers/api/src/index.ts` | Modify (register route) |
| `packages/sdk/src/services/ai-gateway.ts` | Create |
| `packages/sdk/src/client.ts` | Modify (add ai service) |

## Not in Scope

- Dashboard UI (separate task)
- Per-project rate limiting
- API key encryption at rest (use existing workspace encryption pattern later)
- Conversation history
