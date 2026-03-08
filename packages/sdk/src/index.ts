export { SaaSMakerClient, type SaaSMakerConfig } from './client';
export { SaaSMakerError } from './http';

// Re-export service types for convenience
export type { FeedbackRecord, SubmitFeedbackData, FeedbackListResponse, FeedbackListOptions, FeedbackType, FeedbackStatus } from './services/feedback';
export type { WaitlistSignupData, WaitlistSignupResponse, WaitlistCountResponse } from './services/waitlist';
export type { TestimonialRecord, SubmitTestimonialData, TestimonialListResponse, TestimonialListOptions } from './services/testimonials';
export type { ChangelogEntry, ChangelogListResponse } from './services/changelog';
export type { IndexRecord, CreateIndexOptions, UploadDocumentData, UploadDocumentResponse, SearchResult, SearchResponse } from './services/knowledge-base';
export type { TrackEventData, TrackEventResponse } from './services/analytics';
export type { FormRecord, FormQuestion, FormQuestionType, FormListResponse, FormBySlugResponse, FormSubmissionData, FormSubmissionResponse, FormListOptions } from './services/forms';
export type { AIChatMessage, AIChatOptions, AIRagOptions, AIRagResponse } from './services/ai-gateway';
export type { RoadmapItem, RoadmapListResponse } from './services/roadmap';
export type { ProjectReadmeResponse } from './services/projects';
