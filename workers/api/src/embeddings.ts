export interface EmbeddingOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  projectId?: string;
}

export async function getEmbeddings(
  options: EmbeddingOptions,
  texts: string[]
): Promise<number[][]> {
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

export class EmbeddingError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'EmbeddingError';
  }
}
