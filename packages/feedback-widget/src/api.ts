import type { SubmitFeedbackRequest, FeedbackRecord, PaginatedResponse } from '@saas-maker/shared-types';

const DEFAULT_API_BASE = 'https://api.saasmaker.dev';

export function createApiClient(projectId: string, apiBaseUrl?: string) {
  const base = (apiBaseUrl || DEFAULT_API_BASE).replace(/\/$/, '');

  return {
    async submitFeedback(data: SubmitFeedbackRequest): Promise<FeedbackRecord> {
      const res = await fetch(`${base}/v1/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Project-Key': projectId,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },

    async listFeedback(params?: {
      type?: string;
      sort?: string;
      page?: number;
    }): Promise<PaginatedResponse<FeedbackRecord>> {
      const query = new URLSearchParams();
      if (params?.type) query.set('type', params.type);
      if (params?.sort) query.set('sort', params.sort);
      if (params?.page) query.set('page', String(params.page));
      const qs = query.toString();
      const res = await fetch(`${base}/v1/feedback${qs ? `?${qs}` : ''}`, {
        headers: { 'X-Project-Key': projectId },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },

    async uploadImage(file: File): Promise<{ url: string }> {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${base}/v1/upload`, {
        method: 'POST',
        headers: { 'X-Project-Key': projectId },
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
