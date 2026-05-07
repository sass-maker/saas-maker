export { SaaSMakerClient, type SaaSMakerConfig } from './client';
export { SaaSMakerError } from './http';

export type { FeedbackRecord, SubmitFeedbackData, FeedbackListResponse, FeedbackListOptions, FeedbackType, FeedbackStatus } from './services/feedback';
export type { WaitlistSignupData, WaitlistSignupResponse, WaitlistCountResponse } from './services/waitlist';
export type { TestimonialRecord, SubmitTestimonialData, TestimonialListResponse, TestimonialListOptions } from './services/testimonials';
export type { ChangelogEntry, ChangelogListResponse } from './services/changelog';
export type { TrackEventData, TrackEventResponse } from './services/analytics';
export type {
  AIChatCompletionRequest,
  AIEmbeddingRequest,
  AIProviderConfig,
  AIRequestsResponse,
  AIRequestRecord,
  AIUsageStats,
  UpdateAIConfigRequest,
} from './services/ai';
export type { RoadmapItem, RoadmapListResponse } from './services/roadmap';
export type { ProjectReadmeResponse } from './services/projects';
export type { KnowledgeService } from './services/knowledge';
export type { FormsService, FormRecord, FormQuestionRecord, FormResponseRecord, FormQuestionType } from './services/forms';
