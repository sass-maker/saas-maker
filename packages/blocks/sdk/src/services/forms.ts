import { HttpClient } from '../http';

// ---- Types ----

export type FormQuestionType = 'short_text' | 'long_text' | 'multiple_choice' | 'checkboxes' | 'dropdown' | 'yes_no' | 'rating' | 'nps' | 'opinion_scale' | 'email' | 'number' | 'date' | 'phone' | 'url' | 'file_upload';

export interface FormQuestion {
  id: string;
  label: string;
  type: FormQuestionType;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface FormRecord {
  id: string;
  project_id: string;
  name: string;
  slug: string;
  description?: string;
  questions: FormQuestion[];
  created_at: string;
  updated_at: string;
}

export interface FormListResponse {
  data: FormRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface FormBySlugResponse {
  data: FormRecord;
}

export interface FormSubmissionData {
  answers: { question_id: string; value: string }[];
}

export interface FormSubmissionResponse {
  id: string;
  form_id: string;
  submitted_at: string;
}

export interface FormListOptions {
  page?: number;
  limit?: number;
}

// ---- Service ----

export class FormService {
  constructor(private http: HttpClient) {}

  /** List forms (GET /v1/forms). */
  list(options?: FormListOptions): Promise<FormListResponse> {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('limit', String(options.limit));
    const qs = params.toString();
    return this.http.request<FormListResponse>('GET', `/v1/forms${qs ? `?${qs}` : ''}`);
  }

  /** Get a form by slug (GET /v1/forms/by-slug/:slug). */
  getBySlug(slug: string): Promise<FormBySlugResponse> {
    return this.http.request<FormBySlugResponse>(
      'GET',
      `/v1/forms/by-slug/${encodeURIComponent(slug)}`,
    );
  }

  /** Get a public form by slug (GET /v1/forms/public/:slug). */
  getPublic(slug: string): Promise<FormBySlugResponse> {
    return this.http.request<FormBySlugResponse>(
      'GET',
      `/v1/forms/public/${encodeURIComponent(slug)}`,
    );
  }

  /** Submit a form (POST /v1/forms/:formId/submit). */
  submit(formId: string, data: FormSubmissionData): Promise<FormSubmissionResponse> {
    return this.http.request<FormSubmissionResponse>(
      'POST',
      `/v1/forms/${encodeURIComponent(formId)}/submit`,
      data,
    );
  }

  /** Submit a public form by slug (POST /v1/forms/public/:slug/submit). */
  submitPublic(slug: string, data: FormSubmissionData): Promise<FormSubmissionResponse> {
    return this.http.request<FormSubmissionResponse>(
      'POST',
      `/v1/forms/public/${encodeURIComponent(slug)}/submit`,
      data,
    );
  }
}
