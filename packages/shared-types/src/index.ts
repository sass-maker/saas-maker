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
