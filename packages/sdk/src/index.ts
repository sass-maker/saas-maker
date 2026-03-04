export { SaaSMakerClient, type SaaSMakerConfig } from './client';
export { SaaSMakerError } from './http';

// Re-export service types for convenience
export type { FeedbackRecord, SubmitFeedbackData, FeedbackListResponse, FeedbackListOptions, FeedbackType, FeedbackStatus } from './services/feedback';
export type { WaitlistSignupData, WaitlistSignupResponse } from './services/waitlist';
export type { TestimonialRecord, SubmitTestimonialData, TestimonialListResponse, TestimonialListOptions } from './services/testimonials';
export type { ChangelogEntry, ChangelogListResponse } from './services/changelog';
export type { IndexRecord, CreateIndexOptions, UploadDocumentData, UploadDocumentResponse, SearchResult, SearchResponse } from './services/knowledge-base';
export type { TrackEventData, TrackEventResponse } from './services/analytics';
export type { FormRecord, FormQuestion, FormListResponse, FormBySlugResponse, FormSubmissionData, FormSubmissionResponse, FormListOptions } from './services/forms';
