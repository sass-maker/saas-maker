import { HttpClient } from '../http';

// ---- Types ----

export type ChangelogEntryType = 'feature' | 'improvement' | 'fix' | 'breaking';

export interface ChangelogEntry {
  id: string;
  project_id: string;
  title: string;
  content: string;
  version: string | null;
  type: ChangelogEntryType;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChangelogListResponse {
  data: ChangelogEntry[];
}

// ---- Service ----

export class ChangelogService {
  constructor(private http: HttpClient) {}

  /** List published changelog entries (GET /v1/changelog). */
  list(): Promise<ChangelogListResponse> {
    return this.http.request<ChangelogListResponse>('GET', '/v1/changelog');
  }
}
