import { useState, useCallback } from 'react';
import { fetchModels } from '../models';

interface UseModelDiscoveryOptions {
  /** Server-side proxy URL for model discovery (avoids CORS issues). */
  modelsApiUrl?: string;
}

export function useModelDiscovery(options: UseModelDiscoveryOptions = {}) {
  const { modelsApiUrl } = options;
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discover = useCallback(
    async (endpointUrl: string, apiKey: string) => {
      if (!endpointUrl.trim()) return;
      setLoading(true);
      setError(null);
      try {
        let result: string[];
        if (modelsApiUrl) {
          const res = await fetch(modelsApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpointUrl, apiKey }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as { models?: string[] };
          result = data.models ?? [];
        } else {
          result = await fetchModels(endpointUrl, apiKey);
        }
        setModels(result);
      } catch {
        setError('Failed to fetch models');
        setModels([]);
      } finally {
        setLoading(false);
      }
    },
    [modelsApiUrl],
  );

  return { models, loading, error, discover };
}
