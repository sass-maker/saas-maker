export type { CaptureConfig, CaptureKind, SubscriptionRequest } from './contract';
export {
  CATALOG_ID_PATTERN,
  DEFAULT_API_BASE_URL,
  DEFAULT_SOURCE,
  fetchCaptureConfig,
  normalizeApiBaseUrl,
  submitSubscription,
  validateSubscriptionRequest,
} from './contract';
export { NewsletterCapture } from './NewsletterCapture';
export type { NewsletterCaptureProps } from './types';
