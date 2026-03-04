const DEFAULT_BASE_URL = 'https://api.sassmaker.com';

export function createApiClient(projectId: string, baseUrl = DEFAULT_BASE_URL) {
  const base = baseUrl.replace(/\/$/, '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Project-Key': projectId,
  };

  return {
    async getForm(slug: string) {
      const res = await fetch(`${base}/v1/forms/by-slug/${slug}`, { headers });
      if (!res.ok) throw new Error('Form not found');
      return res.json();
    },
    async submitResponse(formId: string, answers: { question_id: string; value: string }[]) {
      const res = await fetch(`${base}/v1/forms/${formId}/submit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error('Failed to submit');
      return res.json();
    },
  };
}
