import { HttpClient } from '../http';

// ---- Types ----

export type FeedbackType = 'bug' | 'feature' | 'feedback';
export type FeedbackStatus = 'new' | 'dismissed' | 'on_roadmap';
export type AnyFeedbackStatus = FeedbackStatus;

export interface SubmitFeedbackData {
  type: FeedbackType;
  title: string;
  description: string;
  image_url?: string;
  submitter_email: string;
  submitter_name?: string;
}

export interface FeedbackRecord {
  id: string;
  project_id: string;
  type: FeedbackType;
  status: AnyFeedbackStatus;
  title: string;
  description: string;
  image_url: string | null;
  submitter_email: string;
  submitter_name: string | null;
  upvote_count: number;
  downvote_count: number;
  created_at: string;
}

export interface FeedbackListOptions {
  type?: FeedbackType;
  status?: AnyFeedbackStatus;
  sort?: 'newest' | 'upvotes';
  page?: number;
}

export interface FeedbackListResponse {
  data: FeedbackRecord[];
  total: number;
  page: number;
  limit: number;
  project?: { name: string; slug: string };
}

// ---- Service ----

export class FeedbackService {
  constructor(private http: HttpClient) {}

  /** Submit new feedback (POST /v1/feedback). */
  submit(data: SubmitFeedbackData): Promise<FeedbackRecord> {
    return this.http.request<FeedbackRecord>('POST', '/v1/feedback', data);
  }

  /** List feedback for the current project (GET /v1/feedback). */
  list(options?: FeedbackListOptions): Promise<FeedbackListResponse> {
    const params = new URLSearchParams();
    if (options?.type) params.set('type', options.type);
    if (options?.status) params.set('status', options.status);
    if (options?.sort) params.set('sort', options.sort);
    if (options?.page) params.set('page', String(options.page));
    const qs = params.toString();
    return this.http.request<FeedbackListResponse>('GET', `/v1/feedback${qs ? `?${qs}` : ''}`);
  }

  /** List feedback by project slug (GET /v1/feedback/by-project/:slug). */
  listByProject(slug: string, options?: FeedbackListOptions): Promise<FeedbackListResponse> {
    const params = new URLSearchParams();
    if (options?.type) params.set('type', options.type);
    if (options?.status) params.set('status', options.status);
    if (options?.sort) params.set('sort', options.sort);
    if (options?.page) params.set('page', String(options.page));
    const qs = params.toString();
    return this.http.request<FeedbackListResponse>(
      'GET',
      `/v1/feedback/by-project/${encodeURIComponent(slug)}${qs ? `?${qs}` : ''}`
    );
  }
}
