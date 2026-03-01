const DEFAULT_API_BASE = 'https://api.saasmaker.dev';

export interface TestimonialData {
  id: string;
  author_name: string;
  author_email: string;
  author_avatar_url: string | null;
  author_title: string | null;
  content: string;
  rating: number;
  image_url: string | null;
  tweet_url: string | null;
  created_at: string;
}

export function createApiClient(projectId: string, apiBaseUrl?: string) {
  const base = (apiBaseUrl || DEFAULT_API_BASE).replace(/\/$/, '');

  return {
    async submit(data: {
      author_name: string;
      author_email: string;
      author_avatar_url?: string;
      author_title?: string;
      content: string;
      rating: number;
      image_url?: string;
      tweet_url?: string;
    }): Promise<{ id: string }> {
      const res = await fetch(`${base}/v1/testimonials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Project-Key': projectId,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Submission failed');
      }
      return res.json();
    },

    async list(limit?: number, sort?: 'newest' | 'rating'): Promise<TestimonialData[]> {
      const params = new URLSearchParams();
      if (limit) params.set('limit', String(limit));
      if (sort) params.set('sort', sort);
      const qs = params.toString();
      const res = await fetch(`${base}/v1/testimonials${qs ? `?${qs}` : ''}`, {
        headers: { 'X-Project-Key': projectId },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.data ?? [];
    },

    async uploadImage(file: File): Promise<{ url: string }> {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${base}/v1/upload`, {
        method: 'POST',
        headers: { 'X-Project-Key': projectId },
        body: form,
      });
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    },
  };
}
