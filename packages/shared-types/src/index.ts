// --- Enums / Unions ---
export type FeedbackType = 'bug' | 'feature' | 'feedback';
export type FeedbackStatus = 'new' | 'in_progress' | 'done' | 'dismissed';

// --- Records (DB row shapes) ---
export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  slug: string;
  api_key: string;
  owner_id: string;
  embedding_model: string | null;
  created_at: string;
}

export interface FeedbackRecord {
  id: string;
  project_id: string;
  type: FeedbackType;
  status: FeedbackStatus;
  title: string;
  description: string;
  image_url: string | null;
  submitter_email: string;
  submitter_name: string | null;
  upvote_count: number;
  created_at: string;
}

export interface UpvoteRecord {
  id: string;
  feedback_id: string;
  user_id: string;
  created_at: string;
}

// --- API Request / Response ---
export interface CreateProjectRequest {
  name: string;
}

export interface SubmitFeedbackRequest {
  type: FeedbackType;
  title: string;
  description: string;
  image_url?: string;
  submitter_email: string;
  submitter_name?: string;
}

export interface UpdateFeedbackStatusRequest {
  status: FeedbackStatus;
}

export interface FeedbackListQuery {
  type?: FeedbackType;
  status?: FeedbackStatus;
  sort?: 'newest' | 'upvotes';
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// --- Vector Memory Service ---

export interface IndexRecord {
  id: string;
  project_id: string;
  name: string;
  external_id: string | null;
  created_at: string;
}

export interface DocumentRecord {
  id: string;
  index_id: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ChunkRecord {
  id: string;
  document_id: string;
  index_id: string;
  content: string;
  chunk_index: number;
  created_at: string;
}

export interface CreateIndexRequest {
  name: string;
  external_id?: string;
  embedding_model?: string;
}

export interface IngestDocumentRequest {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SearchRequest {
  query: string;
  top_k?: number;
}

export interface SearchResult {
  document_id: string;
  chunk_content: string;
  score: number;
  metadata: Record<string, unknown>;
}

// --- Waitlist Service ---

export interface WaitlistEntryRecord {
  id: string;
  project_id: string;
  email: string;
  name: string | null;
  position: number;
  created_at: string;
}

export interface WaitlistSignupRequest {
  email: string;
  name?: string;
}

// --- Analytics Service ---

export interface EventRecord {
  id: string;
  project_id: string;
  name: string;
  url: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  country: string | null;
  device: string | null;
  browser: string | null;
  screen_width: number | null;
  properties: Record<string, unknown>;
  created_at: string;
}

export interface TrackEventRequest {
  name?: string;
  url?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  screen_width?: number;
  properties?: Record<string, unknown>;
}

export interface AnalyticsOverview {
  page_views: number;
  unique_visitors: number;
  top_page: string | null;
  top_referrer: string | null;
}

// --- Widget Props ---
export interface FeedbackWidgetProps {
  projectId: string;
  apiBaseUrl?: string;
  userEmail?: string;
  userName?: string;
  types?: FeedbackType[];
  position?: 'bottom-right' | 'bottom-left';
  theme?: 'light' | 'dark' | 'auto';
  accentColor?: string;
  triggerText?: string;
}
