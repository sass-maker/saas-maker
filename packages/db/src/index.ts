import {
  FeedbackRecord,
  FeedbackListQuery,
  ProjectRecord,
  UserRecord,
  UpvoteRecord,
  IndexRecord,
  DocumentRecord,
} from '@saasmaker/shared-types';

export { TABLES } from './schema';

export interface FeedbackDatabase {
  // Users
  upsertUser(input: { id: string; email: string; name: string | null; avatar_url: string | null }): Promise<UserRecord>;
  getUserById(id: string): Promise<UserRecord | null>;

  // Projects
  createProject(input: { id: string; name: string; slug: string; api_key: string; owner_id: string }): Promise<ProjectRecord>;
  getProjectBySlug(slug: string): Promise<ProjectRecord | null>;
  getProjectByApiKey(apiKey: string): Promise<ProjectRecord | null>;
  getProjectById(id: string): Promise<ProjectRecord | null>;
  listProjectsByOwner(ownerId: string): Promise<ProjectRecord[]>;
  updateProject(id: string, input: Partial<Pick<ProjectRecord, 'name'>>): Promise<ProjectRecord | null>;
  deleteProject(id: string): Promise<boolean>;

  // Feedback
  createFeedback(input: {
    id: string; project_id: string; type: string; title: string;
    description: string; image_url: string | null;
    submitter_email: string; submitter_name: string | null;
  }): Promise<FeedbackRecord>;
  getFeedbackById(id: string): Promise<FeedbackRecord | null>;
  listFeedback(projectId: string, query: FeedbackListQuery): Promise<{ data: FeedbackRecord[]; total: number }>;
  updateFeedbackStatus(id: string, status: string): Promise<FeedbackRecord | null>;
  deleteFeedback(id: string): Promise<boolean>;

  // Upvotes
  addUpvote(input: { id: string; feedback_id: string; user_id: string }): Promise<UpvoteRecord>;
  removeUpvote(feedbackId: string, userId: string): Promise<boolean>;
  hasUpvoted(feedbackId: string, userId: string): Promise<boolean>;

  // Sessions
  createSession(input: { token_hash: string; user_id: string; expires_at: string }): Promise<void>;
  getSessionByTokenHash(tokenHash: string): Promise<{ user_id: string; expires_at: string } | null>;
  deleteSession(tokenHash: string): Promise<void>;

  // Vector Memory - Indexes
  createIndex(input: { id: string; project_id: string; name: string; external_id: string | null }): Promise<IndexRecord>;
  getIndexById(id: string): Promise<IndexRecord | null>;
  listIndexesByProject(projectId: string): Promise<(IndexRecord & { document_count: number })[]>;
  deleteIndex(id: string): Promise<boolean>;

  // Vector Memory - Documents
  createDocument(input: { id: string; index_id: string; content: string; metadata: Record<string, unknown> }): Promise<DocumentRecord>;
  getDocumentById(id: string): Promise<DocumentRecord | null>;
  listDocumentsByIndex(indexId: string, page: number, limit: number): Promise<{ data: DocumentRecord[]; total: number }>;
  deleteDocument(id: string): Promise<boolean>;

  // Vector Memory - Chunks
  createChunks(chunks: { id: string; document_id: string; index_id: string; content: string; embedding: number[]; chunk_index: number }[]): Promise<number>;
  searchChunks(indexId: string, queryEmbedding: number[], topK: number): Promise<{ document_id: string; content: string; score: number; metadata: Record<string, unknown> }[]>;
  deleteChunksByDocument(documentId: string): Promise<boolean>;
}
