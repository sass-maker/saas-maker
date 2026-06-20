/** Internal API/Cockpit contract types (not an npm package). Public types live in `@saas-maker/sdk`. */

export type FeedbackType = 'bug' | 'feature' | 'feedback';
export type FeedbackStatus = 'new' | 'acknowledged' | 'investigating' | 'planned' | 'in_progress' | 'resolved' | 'dismissed' | 'on_roadmap';
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
  ai_base_url?: string | null;
  ai_model?: string | null;
  ai_api_key_configured?: boolean;
  ai_api_key_preview?: string | null;
  readme: string | null;
  source: 'dashboard' | 'linkchat' | string;
  git_url?: string | null;
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
  source?: string;
  git_url?: string;
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
  source: string | null;
  task_id: string | null;
  agent: string | null;
  evidence: string | null;
  created_at: string;
  updated_at: string;
}

export interface FleetChangelogEntry extends ChangelogEntryRecord {
  project_slug: string;
  project_name: string;
}

export interface FleetChangelogDay {
  date: string;
  entries: FleetChangelogEntry[];
  by_project: Record<string, FleetChangelogEntry[]>;
}

export interface CreateChangelogEntryRequest {
  title: string;
  content: string;
  version?: string;
  type?: ChangelogEntryType;
  published?: boolean;
  source?: string;
  task_id?: string;
  agent?: string;
  evidence?: string;
}

export interface UpdateChangelogEntryRequest {
  title?: string;
  content?: string;
  version?: string;
  type?: ChangelogEntryType;
  published?: boolean;
  source?: string;
  task_id?: string;
  agent?: string;
  evidence?: string;
}

// --- Changelog Widget Props ---

export interface ChangelogTimelineProps {
  projectId: string;
  apiBaseUrl?: string;
  theme?: 'light' | 'dark' | 'auto';
  maxItems?: number;
}

// ── AI Gateway ────────────────────────────────────────────────────────────────

export interface AIProviderConfig {
  ai_base_url: string | null;
  ai_model: string | null;
  ai_api_key_configured: boolean;
  ai_api_key_preview: string | null;
}

export interface UpdateAIConfigRequest {
  ai_base_url: string;
  ai_api_key?: string | null;
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

export interface AIRequestsResponse {
  data: AIRequestRecord[];
  total: number;
  limit: number;
  offset: number;
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

// ── AI Mention Check ─────────────────────────────────────────────────────────

export type AIMentionPlatform = 'openai' | 'anthropic' | 'google' | 'perplexity';
export type AIMentionSentiment = 'positive' | 'neutral' | 'negative';

export interface AIMentionCompetitor {
  name: string;
  url?: string;
}

// Internal DB row shape used by the worker before the route sanitizes secrets.
export interface AIMentionConfigDbRecord {
  id: string;
  project_id: string;
  brand_name: string;
  brand_aliases: string;
  brand_url: string | null;
  competitors: string;
  platforms: string;
  openai_api_key: string | null;
  anthropic_api_key: string | null;
  google_api_key: string | null;
  perplexity_api_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIMentionConfigRecord {
  id: string;
  project_id: string;
  brand_name: string;
  brand_aliases: string[];
  brand_url: string | null;
  competitors: AIMentionCompetitor[];
  platforms: AIMentionPlatform[];
  has_openai_key: boolean;
  has_anthropic_key: boolean;
  has_google_key: boolean;
  has_perplexity_key: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIMentionPromptRecord {
  id: string;
  project_id: string;
  prompt_text: string;
  category: string | null;
  created_at: string;
}

export interface AIMentionCheckRecord {
  id: string;
  project_id: string;
  status: 'running' | 'completed' | 'failed';
  total_queries: number;
  completed_queries: number;
  brand_mention_rate: number | null;
  summary: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AIMentionCompetitorResult {
  name: string;
  mentioned: boolean;
  position: number | null;
}

export interface AIMentionResultRecord {
  id: string;
  check_id: string;
  project_id: string;
  prompt_id: string;
  platform: AIMentionPlatform;
  model: string;
  response_text: string;
  brand_mentioned: boolean;
  brand_sentiment: AIMentionSentiment | null;
  brand_position: number | null;
  competitors_mentioned: AIMentionCompetitorResult[];
  citations: string[];
  brand_cited: boolean;
  latency_ms: number | null;
  created_at: string;
}

export interface CreateAIMentionConfigRequest {
  brand_name: string;
  brand_aliases?: string[];
  brand_url?: string;
  competitors?: AIMentionCompetitor[];
  platforms?: AIMentionPlatform[];
  openai_api_key?: string;
  anthropic_api_key?: string;
  google_api_key?: string;
  perplexity_api_key?: string;
}

export interface UpdateAIMentionConfigRequest extends Partial<CreateAIMentionConfigRequest> {}

export interface CreateAIMentionPromptRequest {
  prompt_text: string;
  category?: string;
}

export interface AIMentionCheckDashboard {
  config: AIMentionConfigRecord | null;
  prompts: AIMentionPromptRecord[];
  recent_checks: AIMentionCheckRecord[];
  latest_results: AIMentionResultRecord[];
}
