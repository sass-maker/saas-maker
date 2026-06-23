import { HttpClient } from '../http';

// ---- Types ----

export interface RoadmapItem {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  column: 'backlog' | 'planned' | 'in_progress' | 'done';
  position: number;
  public: boolean;
  vote_count: number;
  created_at: string;
}

export interface RoadmapListResponse {
  data: RoadmapItem[];
  project: { name: string; slug: string };
}

// ---- Service ----

export class RoadmapService {
  constructor(private http: HttpClient) {}

  /** List public roadmap items (GET /v1/roadmap/public/:slug). */
  listPublic(slug: string): Promise<RoadmapListResponse> {
    return this.http.request<RoadmapListResponse>(
      'GET',
      `/v1/roadmap/public/${encodeURIComponent(slug)}`
    );
  }

  /** Vote on a roadmap item (POST /v1/roadmap/public/:slug/:id/vote). */
  vote(
    slug: string,
    itemId: string,
    data: { user_identifier: string; vote: 1 | -1 }
  ): Promise<{ ok: true }> {
    return this.http.request<{ ok: true }>(
      'POST',
      `/v1/roadmap/public/${encodeURIComponent(slug)}/${encodeURIComponent(itemId)}/vote`,
      data
    );
  }

  /** Remove a vote (DELETE /v1/roadmap/public/:slug/:id/vote?user_identifier=...). */
  removeVote(slug: string, itemId: string, userIdentifier: string): Promise<{ ok: true }> {
    const params = new URLSearchParams({ user_identifier: userIdentifier });
    return this.http.request<{ ok: true }>(
      'DELETE',
      `/v1/roadmap/public/${encodeURIComponent(slug)}/${encodeURIComponent(itemId)}/vote?${params}`
    );
  }
}
