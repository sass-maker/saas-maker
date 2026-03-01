import {
  FeedbackRecord,
  FeedbackListQuery,
  ProjectRecord,
  UserRecord,
  UpvoteRecord,
  FeedbackVote,
  IndexRecord,
  DocumentRecord,
  WaitlistEntryRecord,
  EventRecord,
  AnalyticsOverview,
  ShortLinkRecord,
  ShortLinkStats,
  ChangelogEntryRecord,
} from '@saas-maker/shared-types';

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
  updateProject(id: string, input: Partial<Pick<ProjectRecord, 'name' | 'embedding_model'>>): Promise<ProjectRecord | null>;
  deleteProject(id: string): Promise<boolean>;

  // Feedback
  createFeedback(input: {
    id: string; project_id: string; type: string; title: string;
    status?: string;
    description: string; image_url: string | null;
    submitter_email: string; submitter_name: string | null;
  }): Promise<FeedbackRecord>;
  getFeedbackById(id: string): Promise<FeedbackRecord | null>;
  listFeedback(projectId: string, query: FeedbackListQuery, userId?: string): Promise<{ data: FeedbackRecord[]; total: number }>;
  updateFeedbackStatus(id: string, status: string): Promise<FeedbackRecord | null>;
  deleteFeedback(id: string): Promise<boolean>;

  // Votes
  setVote(input: { id: string; feedback_id: string; user_id: string; vote: 1 | -1 }): Promise<UpvoteRecord>;
  removeVote(feedbackId: string, userId: string): Promise<boolean>;
  hasUpvoted(feedbackId: string, userId: string): Promise<boolean>;
  hasDownvoted(feedbackId: string, userId: string): Promise<boolean>;
  getUserVote(feedbackId: string, userId: string): Promise<FeedbackVote>;

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

  // Waitlist
  createWaitlistEntry(input: { id: string; project_id: string; email: string; name: string | null }): Promise<WaitlistEntryRecord>;
  getWaitlistCount(projectId: string): Promise<number>;
  listWaitlistEntries(projectId: string, page: number, limit: number): Promise<{ data: WaitlistEntryRecord[]; total: number }>;
  deleteWaitlistEntry(id: string): Promise<boolean>;

  // Analytics
  createEvent(input: {
    id: string; project_id: string; name: string; url: string | null;
    referrer: string | null; utm_source: string | null; utm_medium: string | null;
    utm_campaign: string | null; country: string | null; device: string | null;
    browser: string | null; screen_width: number | null; properties: Record<string, unknown>;
  }): Promise<EventRecord>;
  getAnalyticsOverview(projectId: string, since: Date): Promise<AnalyticsOverview>;
  getTopPages(projectId: string, since: Date, limit: number): Promise<{ url: string; views: number }[]>;
  getTopReferrers(projectId: string, since: Date, limit: number): Promise<{ referrer: string; count: number }[]>;
  getCountryBreakdown(projectId: string, since: Date, limit: number): Promise<{ country: string; count: number }[]>;
  getDeviceBreakdown(projectId: string, since: Date): Promise<{ device: string; count: number }[]>;
  getCustomEventCounts(projectId: string, since: Date, limit: number): Promise<{ name: string; count: number }[]>;

  // Short Links
  createShortLink(input: { id: string; project_id: string; slug: string; destination: string; title: string | null; expires_at: string | null }): Promise<ShortLinkRecord>;
  getShortLinkBySlug(slug: string): Promise<ShortLinkRecord | null>;
  getShortLinkById(id: string): Promise<ShortLinkRecord | null>;
  listShortLinks(projectId: string, page: number, limit: number): Promise<{ data: ShortLinkRecord[]; total: number }>;
  updateShortLink(id: string, input: { destination?: string; title?: string; expires_at?: string | null }): Promise<ShortLinkRecord | null>;
  deleteShortLink(id: string): Promise<boolean>;
  incrementLinkClickCount(id: string): Promise<void>;
  getShortLinkStats(linkId: string, projectId: string): Promise<ShortLinkStats>;

  // Changelog
  createChangelogEntry(input: {
    id: string; project_id: string; title: string; content: string;
    version: string | null; type: string; published: boolean;
    published_at: string | null;
  }): Promise<ChangelogEntryRecord>;
  updateChangelogEntry(id: string, input: {
    title?: string; content?: string; version?: string;
    type?: string; published?: boolean;
  }): Promise<ChangelogEntryRecord | null>;
  deleteChangelogEntry(id: string): Promise<boolean>;
  getChangelogEntryById(id: string): Promise<ChangelogEntryRecord | null>;
  listChangelogEntries(projectId: string, page: number, limit: number): Promise<{ data: ChangelogEntryRecord[]; total: number }>;
  listPublishedChangelog(projectId: string, limit: number): Promise<ChangelogEntryRecord[]>;
  getChangelogStats(projectId: string): Promise<{ total: number; published: number; drafts: number }>;
}
