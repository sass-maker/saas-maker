const DEFAULT_API_BASE = 'https://api.saasmaker.dev';

export interface ChangelogEntryData {
  id: string;
  title: string;
  content: string;
  version: string | null;
  type: 'feature' | 'improvement' | 'fix' | 'breaking';
  published_at: string | null;
  created_at: string;
}

export function createApiClient(projectId: string, apiBaseUrl?: string) {
  const base = (apiBaseUrl || DEFAULT_API_BASE).replace(/\/$/, '');

  return {
    async list(limit?: number): Promise<ChangelogEntryData[]> {
      const params = new URLSearchParams();
      if (limit) params.set('limit', String(limit));
      const qs = params.toString();
      const res = await fetch(`${base}/v1/changelog${qs ? `?${qs}` : ''}`, {
        headers: { 'X-Project-Key': projectId },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.data ?? [];
    },
  };
}
