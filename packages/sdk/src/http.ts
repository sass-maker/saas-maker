export class SaaSMakerError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'SaaSMakerError';
  }
}

export class HttpClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Project-Key': this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new SaaSMakerError(
        (data as Record<string, string>).error || res.statusText,
        res.status,
      );
    }

    return res.json() as Promise<T>;
  }

  async requestRaw(method: string, path: string, body?: unknown): Promise<Response> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Project-Key': this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new SaaSMakerError(
        (data as Record<string, string>).error || res.statusText,
        res.status,
      );
    }

    return res;
  }
}
