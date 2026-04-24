export type FeedbackType = 'bug' | 'feature' | 'feedback';
export type FeedbackStatus = 'new' | 'in_progress' | 'done' | 'dismissed';
export type AnyFeedbackStatus = FeedbackStatus | string;
export type FeedbackVote = 'up' | 'down' | null;

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

export interface SubmitFeedbackRequest {
  type: FeedbackType;
  title: string;
  description: string;
  image_url?: string;
  submitter_email: string;
  submitter_name?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

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
