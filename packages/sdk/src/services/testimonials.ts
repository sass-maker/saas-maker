import { HttpClient } from '../http';

// ---- Types ----

export type TestimonialStatus = 'pending' | 'approved' | 'rejected';

export interface SubmitTestimonialData {
  author_name: string;
  author_email: string;
  author_avatar_url?: string;
  author_title?: string;
  content: string;
  rating: number;
  image_url?: string;
  tweet_url?: string;
}

export interface SubmitTestimonialResponse {
  id: string;
  status: TestimonialStatus;
  created_at: string;
}

export interface TestimonialRecord {
  id: string;
  project_id: string;
  status: TestimonialStatus;
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

export interface TestimonialListOptions {
  limit?: number;
  sort?: 'newest' | 'rating';
}

export interface TestimonialListResponse {
  data: TestimonialRecord[];
}

// ---- Service ----

export class TestimonialService {
  constructor(private http: HttpClient) {}

  /** Submit a testimonial using API key auth (POST /v1/testimonials). */
  submit(data: SubmitTestimonialData): Promise<SubmitTestimonialResponse> {
    return this.http.request<SubmitTestimonialResponse>('POST', '/v1/testimonials', data);
  }

  /** Submit a testimonial by project slug, no auth required (POST /v1/testimonials/by-project/:slug). */
  submitBySlug(slug: string, data: SubmitTestimonialData): Promise<SubmitTestimonialResponse> {
    return this.http.request<SubmitTestimonialResponse>(
      'POST',
      `/v1/testimonials/by-project/${encodeURIComponent(slug)}`,
      data,
    );
  }

  /** List approved testimonials (GET /v1/testimonials). */
  list(options?: TestimonialListOptions): Promise<TestimonialListResponse> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.sort) params.set('sort', options.sort);
    const qs = params.toString();
    return this.http.request<TestimonialListResponse>(
      'GET',
      `/v1/testimonials${qs ? `?${qs}` : ''}`,
    );
  }
}
