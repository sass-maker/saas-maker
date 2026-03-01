const DEFAULT_API_BASE = 'https://api.saasmaker.dev';

export function createApiClient(projectId: string, apiBaseUrl?: string) {
  const base = (apiBaseUrl || DEFAULT_API_BASE).replace(/\/$/, '');

  return {
    async signup(email: string, name?: string): Promise<{ id: string; position: number }> {
      const res = await fetch(`${base}/v1/waitlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Project-Key': projectId,
        },
        body: JSON.stringify({ email, name: name || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Signup failed');
      }
      return res.json();
    },

    async getCount(): Promise<number> {
      const res = await fetch(`${base}/v1/waitlist/count`, {
        headers: { 'X-Project-Key': projectId },
      });
      if (!res.ok) return 0;
      const data = await res.json();
      return data.count ?? 0;
    },
  };
}

export type WaitlistApiClient = ReturnType<typeof createApiClient>;
