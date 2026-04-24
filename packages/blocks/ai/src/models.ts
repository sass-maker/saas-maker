/**
 * Fetch available models from an OpenAI-compatible endpoint.
 * Tries /models then /v1/models. Works in any runtime (Node, Workers, browser).
 */
export async function fetchModels(
  endpointUrl: string,
  apiKey: string,
): Promise<string[]> {
  const base = endpointUrl.trim().replace(/\/+$/, '');
  if (!base) return [];

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  for (const path of ['/models', '/v1/models']) {
    try {
      const res = await fetch(`${base}${path}`, { method: 'GET', headers });
      if (!res.ok) continue;
      const data = (await res.json()) as { data?: Array<{ id?: string }> };
      if (data?.data && Array.isArray(data.data)) {
        return data.data
          .map((m) => m.id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
          .sort();
      }
    } catch {
      // try next path
    }
  }
  return [];
}
