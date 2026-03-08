export interface EmbeddingOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  projectId?: string;
  ai?: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> };
}

export async function getEmbeddings(
  options: EmbeddingOptions,
  texts: string[]
): Promise<number[][]> {
  // Use Cloudflare AI binding directly for @cf/ models (avoids worker-to-worker fetch issues)
  if (options.model.startsWith('@cf/') && options.ai) {
    const result = await options.ai.run(options.model, { text: texts }) as { data?: number[][]; };
    const rows = extractCfEmbeddings(result);
    if (rows.length !== texts.length) {
      throw new EmbeddingError(
        `Embedding count mismatch: sent ${texts.length} texts, got ${rows.length} embeddings`,
        500
      );
    }
    return rows;
  }

  // Fall back to free-ai gateway for non-CF models
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${options.apiKey}`,
  };

  if (options.projectId) {
    headers['x-gateway-project-id'] = options.projectId;
  }

  const response = await fetch(`${options.baseUrl}/v1/embeddings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: options.model,
      input: texts,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    const requestId = response.headers.get('x-request-id') || 'unknown';
    throw new EmbeddingError(
      `Embedding API error (${response.status}, req=${requestId}): ${error}`,
      response.status
    );
  }

  const data = (await response.json()) as { data: { embedding: number[] }[] };

  if (data.data.length !== texts.length) {
    throw new EmbeddingError(
      `Embedding count mismatch: sent ${texts.length} texts, got ${data.data.length} embeddings`,
      500
    );
  }

  return data.data.map((d) => d.embedding);
}

function extractCfEmbeddings(result: unknown): number[][] {
  if (!result) return [];
  if (Array.isArray(result) && Array.isArray(result[0])) return result;
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if (Array.isArray(r.data) && Array.isArray(r.data[0])) return r.data;
    if (Array.isArray(r.embeddings) && Array.isArray(r.embeddings[0])) return r.embeddings;
  }
  return [];
}

export class EmbeddingError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'EmbeddingError';
  }
}
