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
  AnalyticsDashboard,
  AnalyticsDetailResult,

  ChangelogEntryRecord,
  TestimonialRecord,
  FormRecord,
  FormQuestionRecord,
  FormResponseRecord,
  FormAnswerRecord,
} from '@saas-maker/shared-types';

export { TABLES } from './schema';

export interface FeedbackDatabase {
  // Users
  upsertUser(input: { id: string; email: string; name: string | null; avatar_url: string | null }): Promise<UserRecord>;
  getUserById(id: string): Promise<UserRecord | null>;

  // Projects
  createProject(input: { id: string; name: string; slug: string; api_key: string; owner_id: string; source?: string }): Promise<ProjectRecord>;
  getProjectBySlug(slug: string): Promise<ProjectRecord | null>;
  getProjectByApiKey(apiKey: string): Promise<ProjectRecord | null>;
  getProjectById(id: string): Promise<ProjectRecord | null>;
  listProjectsByOwner(ownerId: string, source?: string): Promise<ProjectRecord[]>;
  updateProject(id: string, input: Partial<Pick<ProjectRecord, 'name' | 'embedding_model' | 'rate_limit_rpm' | 'rate_limit_enabled' | 'readme'>>): Promise<ProjectRecord | null>;
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
    os: string | null; is_bot: boolean; session_id: string | null; pathname: string | null;
  }): Promise<EventRecord>;
  getAnalyticsOverview(projectId: string, since: Date): Promise<AnalyticsOverview>;
  getTopPages(projectId: string, since: Date, limit: number): Promise<{ url: string; views: number }[]>;
  getTopReferrers(projectId: string, since: Date, limit: number): Promise<{ referrer: string; count: number }[]>;
  getCountryBreakdown(projectId: string, since: Date, limit: number): Promise<{ country: string; count: number }[]>;
  getDeviceBreakdown(projectId: string, since: Date): Promise<{ device: string; count: number }[]>;
  getCustomEventCounts(projectId: string, since: Date, limit: number): Promise<{ name: string; count: number }[]>;
  getAnalyticsDashboard(projectId: string, since: Date, includeBots: boolean, isToday: boolean): Promise<AnalyticsDashboard>;
  getAnalyticsDetail(projectId: string, since: Date, includeBots: boolean, section: string, limit: number, offset: number): Promise<AnalyticsDetailResult>;

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

  // Testimonials
  createTestimonial(input: {
    id: string; project_id: string; author_name: string; author_email: string;
    author_avatar_url: string | null; author_title: string | null;
    content: string; rating: number; image_url: string | null; tweet_url: string | null;
  }): Promise<TestimonialRecord>;
  listApprovedTestimonials(projectId: string, limit?: number, sort?: 'newest' | 'rating'): Promise<TestimonialRecord[]>;
  listAllTestimonials(projectId: string, page: number, limit: number): Promise<{ data: TestimonialRecord[]; total: number }>;
  getTestimonialStats(projectId: string): Promise<{ total: number; pending: number; approved: number; avg_rating: number }>;
  updateTestimonialStatus(id: string, status: string): Promise<TestimonialRecord | null>;
  deleteTestimonial(id: string): Promise<boolean>;
  getTestimonialById(id: string): Promise<TestimonialRecord | null>;

  // Forms
  createForm(input: {
    id: string;
    project_id: string;
    title: string;
    slug: string;
    description: string | null;
    status: string;
    theme: Record<string, unknown>;
    settings: Record<string, unknown>;
  }): Promise<FormRecord>;
  getFormById(id: string): Promise<FormRecord | null>;
  getFormBySlug(projectId: string, slug: string): Promise<FormRecord | null>;
  getPublishedFormBySlug(slug: string): Promise<(FormRecord & { project_api_key: string }) | null>;
  listForms(projectId: string, page: number, limit: number): Promise<{ data: FormRecord[]; total: number }>;
  updateForm(id: string, input: Partial<{
    title: string;
    slug: string;
    description: string | null;
    status: string;
    theme: Record<string, unknown>;
    settings: Record<string, unknown>;
  }>): Promise<FormRecord | null>;
  deleteForm(id: string): Promise<boolean>;
  getFormStats(projectId: string): Promise<{ total_forms: number; total_responses: number }>;

  // Form Questions
  upsertFormQuestions(formId: string, questions: Array<{
    id: string;
    type: string;
    label: string;
    description: string | null;
    required: boolean;
    options: Record<string, unknown>;
    order_index: number;
  }>): Promise<FormQuestionRecord[]>;
  listFormQuestions(formId: string): Promise<FormQuestionRecord[]>;
  updateFormQuestion(id: string, input: Partial<{
    type: string;
    label: string;
    description: string | null;
    required: boolean;
    options: Record<string, unknown>;
    order_index: number;
  }>): Promise<FormQuestionRecord | null>;
  deleteFormQuestion(id: string): Promise<boolean>;

  // Form Responses
  createFormResponse(input: {
    id: string;
    form_id: string;
  }): Promise<FormResponseRecord>;
  createFormAnswers(answers: Array<{
    id: string;
    response_id: string;
    question_id: string;
    value: string | null;
  }>): Promise<FormAnswerRecord[]>;
  listFormResponses(formId: string, page: number, limit: number): Promise<{ data: (FormResponseRecord & { answers: FormAnswerRecord[] })[]; total: number }>;
  deleteFormResponse(id: string): Promise<boolean>;
  getFormResponseCount(formId: string): Promise<number>;
  getFormAnswersByQuestionId(questionId: string): Promise<FormAnswerRecord[]>;

  // AI Gateway
  getProjectAIConfig(projectId: string): Promise<{ ai_base_url: string | null; ai_api_key: string | null; ai_model: string | null }>;
  updateProjectAIConfig(projectId: string, config: { ai_base_url: string; ai_api_key: string; ai_model: string }): Promise<void>;
  deleteProjectAIConfig(projectId: string): Promise<void>;
  logAIRequest(params: {
    id: string; projectId: string; endpoint: string; model: string;
    status: 'success' | 'error' | 'timeout'; latencyMs: number | null;
    inputTokens: number | null; outputTokens: number | null; errorMessage: string | null;
  }): Promise<void>;
  getAIUsageStats(projectId: string, daysBack?: number): Promise<{ total_requests: number; success_count: number; error_count: number; avg_latency_ms: number | null; total_input_tokens: number; total_output_tokens: number }>;
  listAIRequests(projectId: string, limit?: number, offset?: number): Promise<{ data: import('@saas-maker/shared-types').AIRequestRecord[]; total: number }>;

  // CLI Auth
  createCliAuthCode(code: string): Promise<void>;
  getCliAuthCode(code: string): Promise<{ code: string; user_id: string | null; status: string; token: string | null; expires_at: string } | undefined>;
  approveCliAuthCode(code: string, userId: string, token: string): Promise<void>;
  deleteCliAuthCode(code: string): Promise<void>;
  createCliToken(token: string, userId: string): Promise<void>;
  getCliTokenUser(token: string): Promise<{ user_id: string } | undefined>;

  // Roadmap
  createRoadmapItem(input: {
    id: string; project_id: string; feedback_id: string | null;
    title: string; description: string | null; column: string;
    position: number; public: boolean;
  }): Promise<import('@saas-maker/shared-types').RoadmapItemRecord>;
  getRoadmapItemById(id: string): Promise<import('@saas-maker/shared-types').RoadmapItemRecord | null>;
  listRoadmapItems(projectId: string, publicOnly?: boolean): Promise<import('@saas-maker/shared-types').RoadmapItemRecord[]>;
  updateRoadmapItem(id: string, input: {
    title?: string; description?: string; column?: string;
    position?: number; public?: boolean;
  }): Promise<import('@saas-maker/shared-types').RoadmapItemRecord | null>;
  deleteRoadmapItem(id: string): Promise<boolean>;
  batchUpdateRoadmapPositions(items: { id: string; column: string; position: number }[]): Promise<void>;
  getNextRoadmapPosition(projectId: string, column: string): Promise<number>;

  // Roadmap Votes
  setRoadmapVote(input: { id: string; roadmap_item_id: string; user_identifier: string; vote: 1 | -1 }): Promise<void>;
  removeRoadmapVote(roadmapItemId: string, userIdentifier: string): Promise<boolean>;
  getRoadmapVote(roadmapItemId: string, userIdentifier: string): Promise<1 | -1 | null>;

  // Directory
  createDirectoryListing(input: {
    id: string; name: string; tagline: string; url: string;
    description: string | null; logo_url: string | null;
    screenshot_url: string | null; twitter_url: string | null;
    project_id: string | null; tags: string[];
  }): Promise<import('@saas-maker/shared-types').DirectoryListingRecord>;
  listDirectoryListings(page: number, limit: number, tag?: string, search?: string, status?: import('@saas-maker/shared-types').DirectoryListingStatus): Promise<{ data: import('@saas-maker/shared-types').DirectoryListingRecord[]; total: number }>;
  getDirectoryListingById(id: string): Promise<import('@saas-maker/shared-types').DirectoryListingRecord | null>;
  getDirectoryListingByProjectId(projectId: string): Promise<import('@saas-maker/shared-types').DirectoryListingRecord | null>;
  updateDirectoryListingBadgeVerified(id: string, verified: boolean): Promise<void>;

  // AI Mention Check
  upsertAIMentionConfig(input: {
    id: string; project_id: string; brand_name: string;
    brand_aliases: string; brand_url: string | null;
    competitors: string; platforms: string;
    openai_api_key: string | null; anthropic_api_key: string | null;
    google_api_key: string | null; perplexity_api_key: string | null;
  }): Promise<import('@saas-maker/shared-types').AIMentionConfigDbRecord>;
  getAIMentionConfig(projectId: string): Promise<import('@saas-maker/shared-types').AIMentionConfigDbRecord | null>;
  deleteAIMentionConfig(projectId: string): Promise<boolean>;

  createAIMentionPrompt(input: { id: string; project_id: string; prompt_text: string; category: string | null }): Promise<import('@saas-maker/shared-types').AIMentionPromptRecord>;
  listAIMentionPrompts(projectId: string): Promise<import('@saas-maker/shared-types').AIMentionPromptRecord[]>;
  deleteAIMentionPrompt(id: string): Promise<boolean>;
  countAIMentionPrompts(projectId: string): Promise<number>;

  createAIMentionCheck(input: { id: string; project_id: string; total_queries: number }): Promise<import('@saas-maker/shared-types').AIMentionCheckRecord>;
  updateAIMentionCheck(id: string, input: { status?: string; completed_queries?: number; brand_mention_rate?: number | null; summary?: string | null; completed_at?: string | null }): Promise<import('@saas-maker/shared-types').AIMentionCheckRecord | null>;
  listAIMentionChecks(projectId: string, limit?: number): Promise<import('@saas-maker/shared-types').AIMentionCheckRecord[]>;
  getAIMentionCheckById(id: string): Promise<import('@saas-maker/shared-types').AIMentionCheckRecord | null>;

  createAIMentionResult(input: {
    id: string; check_id: string; project_id: string; prompt_id: string;
    platform: string; model: string; response_text: string;
    brand_mentioned: boolean; brand_sentiment: string | null;
    brand_position: number | null; competitors_mentioned: string;
    citations: string; brand_cited: boolean; latency_ms: number | null;
  }): Promise<void>;
  listAIMentionResults(checkId: string): Promise<import('@saas-maker/shared-types').AIMentionResultRecord[]>;
}
