// Local type definitions mirroring @saasmaker/shared-types
// These will be replaced with imports from the shared-types package
// once the workspace dependency is wired up.

export type FeedbackType = "bug" | "feature" | "feedback";
export type FeedbackStatus = "new" | "in_progress" | "done" | "dismissed";

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

export interface ProjectRecord {
  id: string;
  name: string;
  slug: string;
  api_key: string;
  owner_id: string;
  created_at: string;
}
