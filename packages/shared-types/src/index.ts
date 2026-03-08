// --- Enums / Unions ---
export type FeedbackType = 'bug' | 'feature' | 'feedback';
export type FeedbackStatus = 'new' | 'dismissed' | 'on_roadmap';
export type AnyFeedbackStatus = FeedbackStatus;
export type FeedbackVote = 'up' | 'down' | null;

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
  rate_limit_rpm: number;
  rate_limit_enabled: boolean;
  readme: string | null;
  created_at: string;
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
  viewer_vote?: FeedbackVote;
  created_at: string;
}

export interface UpvoteRecord {
  id: string;
  feedback_id: string;
  user_id: string;
  vote: 1 | -1;
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
  status: AnyFeedbackStatus;
}

export interface FeedbackListQuery {
  type?: FeedbackType;
  status?: AnyFeedbackStatus;
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

export interface WaitlistFormProps {
  projectId: string;
  apiBaseUrl?: string;
  theme?: 'light' | 'dark' | 'auto';
  accentColor?: string;
  showCount?: boolean;
  onSuccess?: (position: number) => void;
  placeholder?: string;
  buttonText?: string;
}

// --- Testimonials Service ---

export type TestimonialStatus = 'pending' | 'approved' | 'rejected';

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

export interface SubmitTestimonialRequest {
  author_name: string;
  author_email: string;
  author_avatar_url?: string;
  author_title?: string;
  content: string;
  rating: number;
  image_url?: string;
  tweet_url?: string;
}

export interface UpdateTestimonialStatusRequest {
  status: TestimonialStatus;
}

// --- Testimonials Widget Props ---

export interface TestimonialFormProps {
  projectId: string;
  apiBaseUrl?: string;
  theme?: 'light' | 'dark' | 'auto';
  accentColor?: string;
  placeholder?: string;
  buttonText?: string;
  showImageUpload?: boolean;
  showTweetUrl?: boolean;
}

export interface TestimonialWallProps {
  projectId: string;
  apiBaseUrl?: string;
  theme?: 'light' | 'dark' | 'auto';
  accentColor?: string;
  layout?: 'masonry' | 'grid' | 'list';
  maxItems?: number;
}

// --- Changelog Service ---

export type ChangelogEntryType = 'feature' | 'improvement' | 'fix' | 'breaking';

export interface ChangelogEntryRecord {
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

export interface CreateChangelogEntryRequest {
  title: string;
  content: string;
  version?: string;
  type?: ChangelogEntryType;
  published?: boolean;
}

export interface UpdateChangelogEntryRequest {
  title?: string;
  content?: string;
  version?: string;
  type?: ChangelogEntryType;
  published?: boolean;
}

// --- Changelog Widget Props ---

export interface ChangelogTimelineProps {
  projectId: string;
  apiBaseUrl?: string;
  theme?: 'light' | 'dark' | 'auto';
  maxItems?: number;
}

// --- Forms / Surveys ---

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
  metadata: Record<string, unknown>;
}

export interface FormAnswerRecord {
  id: string;
  response_id: string;
  question_id: string;
  value: string | null;
}

export interface CreateFormRequest {
  title: string;
  slug: string;
  description?: string;
  status?: 'draft' | 'published' | 'closed';
  theme?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface UpdateFormRequest {
  title?: string;
  slug?: string;
  description?: string;
  status?: 'draft' | 'published' | 'closed';
  theme?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface UpsertFormQuestionRequest {
  id?: string;
  type: FormQuestionType;
  label: string;
  description?: string;
  required?: boolean;
  options?: Record<string, unknown>;
  order_index: number;
}

export interface SubmitFormResponseRequest {
  answers: { question_id: string; value: string }[];
  metadata?: Record<string, unknown>;
}

export interface FormAnalyticsQuestion {
  question_id: string;
  label: string;
  type: FormQuestionType;
  total_answers: number;
  summary: Record<string, unknown>;
}

export interface FormAnalyticsResponse {
  form_id: string;
  total_responses: number;
  questions: FormAnalyticsQuestion[];
}

export interface SurveyWidgetProps {
  projectId: string;
  formSlug: string;
  theme?: 'light' | 'dark' | 'auto';
  accentColor?: string;
  onComplete?: (response: FormResponseRecord) => void;
}

// ── AI Gateway ────────────────────────────────────────────────────────────────

export interface AIProviderConfig {
  ai_base_url: string | null;
  ai_api_key: string | null;
  ai_model: string | null;
}

export interface UpdateAIConfigRequest {
  ai_base_url: string;
  ai_api_key: string;
  ai_model: string;
}

export interface AIRequestRecord {
  id: string;
  project_id: string;
  endpoint: string;
  model: string;
  status: 'success' | 'error' | 'timeout';
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  error_message: string | null;
  created_at: string;
}

export interface AIUsageStats {
  total_requests: number;
  success_count: number;
  error_count: number;
  avg_latency_ms: number | null;
  total_input_tokens: number;
  total_output_tokens: number;
}

export interface AIChatCompletionRequest {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface AIEmbeddingRequest {
  input: string | string[];
  model?: string;
}

export interface AIRagRequest {
  index_id: string;
  query: string;
  system_prompt?: string;
  top_k?: number;
  stream?: boolean;
}

export interface AIRagResponse {
  response: string;
  sources: Array<{ document_id: string; chunk_content: string; score: number }>;
  usage: { input_tokens: number; output_tokens: number };
}

// --- Roadmap ---

export type RoadmapColumn = 'backlog' | 'planned' | 'in_progress' | 'done';

export interface RoadmapItemRecord {
  id: string;
  project_id: string;
  feedback_id: string | null;
  title: string;
  description: string | null;
  column: RoadmapColumn;
  position: number;
  public: boolean;
  upvote_count: number;
  downvote_count: number;
  created_at: string;
  updated_at: string;
}

export interface RoadmapVoteRecord {
  id: string;
  roadmap_item_id: string;
  user_identifier: string;
  vote: 1 | -1;
  created_at: string;
}

export interface CreateRoadmapItemRequest {
  title: string;
  description?: string;
  column?: RoadmapColumn;
  public?: boolean;
}

export interface UpdateRoadmapItemRequest {
  title?: string;
  description?: string;
  column?: RoadmapColumn;
  position?: number;
  public?: boolean;
}

export interface ReorderRoadmapRequest {
  items: { id: string; column: RoadmapColumn; position: number }[];
}
