import { HttpClient } from '../http';

// ---- Types ----

export type FormQuestionType =
  | 'short_text'
  | 'long_text'
  | 'multiple_choice'
  | 'checkboxes'
  | 'dropdown'
  | 'yes_no'
  | 'rating'
  | 'nps'
  | 'opinion_scale'
  | 'email'
  | 'number'
  | 'date'
  | 'phone'
  | 'url'
  | 'file_upload';

export interface FormRecord {
  id: string;
  project_id: string;
  title: string;
  slug: string;
  description: string | null;
  status: 'draft' | 'published' | 'closed';
  theme: Record<string, unknown>;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FormQuestionRecord {
  id: string;
  form_id: string;
  type: FormQuestionType;
  label: string;
  description: string | null;
  required: boolean;
  options: Record<string, unknown>;
  order_index: number;
  created_at: string;
}

export interface FormResponseRecord {
  id: string;
  form_id: string;
  submitted_at: string;
  answers: { id: string; question_id: string; value: string }[];
}

export interface FormListResponse {
  data: FormRecord[];
  total: number;
  page: number;
  limit: number;
  stats?: { total_forms: number; total_responses: number };
}

// ---- Service ----

export class FormsService {
  constructor(private http: HttpClient) {}

  /** List forms for a project (GET /v1/forms/dashboard/:projectId). Requires session auth. */
  list(projectId: string, page = 1): Promise<FormListResponse> {
    return this.http.request<FormListResponse>('GET', `/v1/forms/dashboard/${projectId}?page=${page}`);
  }

  /** Create a new form (POST /v1/forms/dashboard/:projectId). Requires session auth. */
  create(projectId: string, data: { title: string; slug: string; description?: string }): Promise<{ data: FormRecord }> {
    return this.http.request<{ data: FormRecord }>('POST', `/v1/forms/dashboard/${projectId}`, data);
  }

  /** Get form detail with questions (GET /v1/forms/dashboard/:projectId/:formId). Requires session auth. */
  get(projectId: string, formId: string): Promise<{ data: FormRecord & { questions: FormQuestionRecord[]; response_count: number } }> {
    return this.http.request<{ data: FormRecord & { questions: FormQuestionRecord[]; response_count: number } }>(
      'GET',
      `/v1/forms/dashboard/${projectId}/${formId}`
    );
  }

  /** Get published form by slug (GET /v1/forms/by-slug/:slug). Requires API key. */
  getBySlug(slug: string): Promise<{ data: FormRecord & { questions: FormQuestionRecord[] } }> {
    return this.http.request<{ data: FormRecord & { questions: FormQuestionRecord[] } }>('GET', `/v1/forms/by-slug/${slug}`);
  }

  /** Submit a form response (POST /v1/forms/:formId/submit). Requires API key. */
  submit(formId: string, answers: { question_id: string; value: string }[]): Promise<{ id: string; ok: true }> {
    return this.http.request<{ id: string; ok: true }>('POST', `/v1/forms/${formId}/submit`, { answers });
  }
}
