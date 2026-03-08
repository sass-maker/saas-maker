# AI Gateway + Chat Completions for saas-maker

## Context

Two needs converging into one design:
1. **RAG Chat** — LinkChat (personal site builder) needs a RAG chat endpoint using saas-maker's vector search
2. **BYOK AI Gateway** — saas-maker should offer AI as a service where users configure their own provider

Both need the same foundation: AI provider config per project + LLM provider abstraction.

## AI Provider Config

Add to the `projects` table (simple columns, not a separate table):

```sql
ALTER TABLE projects ADD COLUMN ai_base_url TEXT;     -- e.g. https://api.openai.com/v1
ALTER TABLE projects ADD COLUMN ai_api_key TEXT;       -- encrypted at rest
ALTER TABLE projects ADD COLUMN ai_model TEXT;         -- e.g. gpt-4o, claude-sonnet-4-20250514
```

Three fields cover every provider via OpenAI-compatible format:
- OpenAI: `https://api.openai.com/v1`
- Anthropic: `https://api.anthropic.com/v1` (OpenAI-compat layer)
- Groq: `https://api.groq.com/openai/v1`
- Gemini: `https://generativelanguage.googleapis.com/v1beta/openai`
- OpenRouter: `https://openrouter.ai/api/v1`
- free-ai: `https://free-ai-gateway.sarthakagrawal927.workers.dev/v1`
- Any self-hosted: `http://localhost:1234/v1`

No `ai_provider` enum needed — base_url is the universal identifier.

## Dashboard UI

In project settings, add "AI Provider" section:
- Text input: Base URL (with provider quick-select dropdown that auto-fills the URL)
- Text input: API key (masked, encrypted at rest)
- Text input: Model name
- "Test Connection" button

## API Routes

### 1. AI Config (dashboard auth — `requireSession`)

```
GET  /v1/ai/config                    — get project's AI config (key masked)
PUT  /v1/ai/config                    — set/update AI config
DELETE /v1/ai/config                  — remove AI config
```

### 2. Generic AI Proxy (API key auth — `requireApiKey`)

```
POST /v1/ai/chat/completions          — proxy to provider's chat/completions
POST /v1/ai/embeddings                — proxy to provider's embeddings
```

Passthrough proxy: forward request body to `{base_url}/chat/completions` with the project's configured API key. Stream SSE responses through.

### 3. RAG Chat (API key auth — `requireApiKey`)

```
POST /v1/ai/rag                        — RAG-enhanced chat (vector search + context + AI)
```

**Request:**
```json
{
  "index_id": "uuid",
  "query": "Tell me about Sarthak's experience",
  "system_prompt": "You are a helpful assistant...",
  "top_k": 5,
  "stream": true
}
```

**Flow:**
1. Validate request, get project from API key
2. Embed query via existing vector search
3. Search chunks via `db.searchChunks(indexId, queryEmbedding, topK)`
4. Build prompt with retrieved context
5. Call project's configured AI provider via the LLM abstraction
6. Stream response back

**Response (streaming):**
```
data: {"type":"chunk","content":"Sarthak is a..."}
data: {"type":"done","usage":{"input_tokens":450,"output_tokens":120}}
```

**Response (non-streaming):**
```json
{
  "response": "Sarthak is a software engineer...",
  "sources": [{ "document_id": "uuid", "chunk_content": "...", "score": 0.89 }],
  "usage": { "input_tokens": 450, "output_tokens": 120 }
}
```

### 4. Usage (dashboard auth)

```
GET /v1/ai/usage                       — usage stats
GET /v1/ai/requests                    — request log
```

## Usage Tracking

New table:

```sql
CREATE TABLE ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,             -- 'chat/completions', 'embeddings', 'rag/chat'
  model TEXT NOT NULL,
  status TEXT NOT NULL,               -- 'success', 'error', 'timeout'
  latency_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_requests_project_date ON ai_requests(project_id, created_at DESC);
```

## LLM Provider Abstraction

**New file: `workers/api/src/llm.ts`**

Since all providers use OpenAI-compatible format (that's why we store base_url):

```typescript
interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface ChatOptions {
  config: LLMConfig;
  messages: Array<{ role: string; content: string }>;
  stream: boolean;
}

// All providers get the same OpenAI-format call:
// POST {baseUrl}/chat/completions
// Authorization: Bearer {apiKey}
// body: { model, messages, stream }
async function chatCompletion(options: ChatOptions): Promise<ReadableStream | string>
```

No provider-specific code needed. OpenAI-compatible format is the universal contract.

## Implementation Phases

### Phase 1: Config + DB
- Migration: add `ai_base_url`, `ai_api_key`, `ai_model` columns to `projects`
- Migration: create `ai_requests` table
- DB queries: `getProjectAIConfig()`, `updateProjectAIConfig()`, `logAIRequest()`
- Config CRUD routes
- Encrypt API keys at rest

### Phase 2: LLM Abstraction + Generic Proxy
- `workers/api/src/llm.ts` — universal OpenAI-format caller
- `POST /v1/ai/chat/completions` — proxy route with SSE streaming
- `POST /v1/ai/embeddings` — proxy route
- Request logging to `ai_requests` table

### Phase 3: RAG Chat
- `POST /v1/chat/completions` — vector search + context building + AI call
- Streaming support
- Source attribution in response

### Phase 4: Dashboard
- AI config settings page
- Usage analytics page (requests, tokens, latency over time)
- Request log table

### Phase 5: SDK
- `client.ai.chat(messages)` — generic AI proxy
- `client.ai.embed(input)` — embedding proxy
- `client.ai.ragChat({ indexId, query })` — RAG chat

## Shared Types

```typescript
interface AIProviderConfig {
  ai_base_url: string;
  ai_api_key: string;
  ai_model: string;
}

interface ChatCompletionRequest {
  index_id: string;
  query: string;
  system_prompt?: string;
  top_k?: number;
  stream?: boolean;
}

interface ChatCompletionResponse {
  response: string;
  sources: { document_id: string; chunk_content: string; score: number }[];
  usage: { input_tokens: number; output_tokens: number };
}
```

## File Changes Summary

| File | Action |
|------|--------|
| `packages/db/migrations/XXXX_ai_gateway.sql` | New — add columns + ai_requests table |
| `packages/db/src/index.ts` | Add AI config + usage queries |
| `packages/shared-types/src/index.ts` | Add AI types |
| `workers/api/src/llm.ts` | New — universal OpenAI-format LLM caller |
| `workers/api/src/routes/ai-gateway.ts` | New — config CRUD + proxy + usage routes |
| `workers/api/src/routes/chat.ts` | New — RAG chat route |
| `workers/api/src/index.ts` | Register new routes |
| `apps/dashboard/` | AI config UI + usage dashboard |

## Not in Scope (add later)
- Per-project rate limiting
- Billing / cost tracking
- Conversation history (client-side responsibility)
- Multiple provider configs per project
