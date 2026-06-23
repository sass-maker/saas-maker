export class SaaSMakerError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'SaaSMakerError';
  }
}

export type AuthMode = 'project' | 'session' | 'none';

interface RequestOptions {
  auth?: AuthMode;
}

export class HttpClient {
  constructor(
    private baseUrl: string,
    private apiKey?: string,
    private sessionToken?: string
  ) {}

  private buildHeaders(auth: AuthMode = 'project'): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (auth === 'project') {
      if (!this.apiKey) {
        throw new SaaSMakerError(
          'Project API key is required for project-authenticated endpoints',
          401
        );
      }
      headers['X-Project-Key'] = this.apiKey;
    } else if (auth === 'session') {
      if (!this.sessionToken) {
        throw new SaaSMakerError(
          'Session token is required for session-authenticated endpoints',
          401
        );
      }
      headers.Authorization = `Bearer ${this.sessionToken}`;
    }

    return headers;
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: RequestOptions = {}
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.buildHeaders(options.auth),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new SaaSMakerError(
        (data as Record<string, string>).error || res.statusText,
        res.status
      );
    }

    return res.json() as Promise<T>;
  }

  async requestRaw(
    method: string,
    path: string,
    body?: unknown,
    options: RequestOptions = {}
  ): Promise<Response> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.buildHeaders(options.auth),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new SaaSMakerError(
        (data as Record<string, string>).error || res.statusText,
        res.status
      );
    }

    return res;
  }
}
