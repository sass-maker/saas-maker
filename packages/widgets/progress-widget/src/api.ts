import type { PublicProgressResponse } from '@saas-maker/shared-types';

const DEFAULT_API_BASE = 'https://api.sassmaker.com';

export function createApiClient(apiBaseUrl?: string) {
  const base = (apiBaseUrl || DEFAULT_API_BASE).replace(/\/$/, '');

  return {
    async getPublicProgress(slug: string, changelogLimit?: number): Promise<PublicProgressResponse | null> {
      const params = new URLSearchParams();
      if (changelogLimit) params.set('changelog_limit', String(changelogLimit));
      const qs = params.toString();
      const res = await fetch(`${base}/v1/progress/public/${encodeURIComponent(slug)}${qs ? `?${qs}` : ''}`);
      if (!res.ok) return null;
      return res.json() as Promise<PublicProgressResponse>;
    },
  };
}
