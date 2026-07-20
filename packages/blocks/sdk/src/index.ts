export { SaaSMakerClient, type SaaSMakerConfig } from './client';
export { SaaSMakerError } from './http';
export {
  createAppHealth,
  normalizeAppHealthRoute,
  type AppHealthClient,
  type AppHealthDiagnostics,
  type AppHealthOptions,
  type AppHealthRecord,
  type ExpressCompatibleMiddleware,
} from './app-health';

export type {
  FeedbackRecord,
  SubmitFeedbackData,
  FeedbackListResponse,
  FeedbackListOptions,
  FeedbackType,
  FeedbackStatus,
} from './services/feedback';
export type {
  WaitlistSignupData,
  WaitlistSignupResponse,
  WaitlistCountResponse,
} from './services/waitlist';
export type {
  TestimonialRecord,
  SubmitTestimonialData,
  TestimonialListResponse,
  TestimonialListOptions,
} from './services/testimonials';
export type { ChangelogEntry, ChangelogListResponse } from './services/changelog';
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
export type { FleetEventInput, EmitResponse } from './services/events';
export type { FleetTask, DrainOptions, DrainResult } from './services/worker';
