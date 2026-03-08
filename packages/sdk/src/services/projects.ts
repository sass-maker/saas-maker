import { HttpClient } from '../http';

// ---- Types ----

export interface ProjectReadmeResponse {
  readme: string;
}

// ---- Service ----

export class ProjectService {
  constructor(private http: HttpClient) {}

  /** Get project README (GET /v1/projects/readme). */
  getReadme(): Promise<ProjectReadmeResponse> {
    return this.http.request<ProjectReadmeResponse>('GET', '/v1/projects/readme');
  }

  /** Update project README (PUT /v1/projects/readme). */
  updateReadme(content: string): Promise<{ ok: true }> {
    return this.http.request<{ ok: true }>('PUT', '/v1/projects/readme', { content });
  }
}
