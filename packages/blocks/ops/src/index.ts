export { FoundryError, FoundryErrors } from './error.js';
export type { FoundryErrorCode, FoundryErrorMeta } from './error.js';
export { trace, traceSync } from './trace.js';
export type { TraceOptions } from './trace.js';
export { configurePostHog, capture, identify, flushPostHog } from './posthog.js';
export type { TraceEvent, CaptureEvent, IdentifyPayload } from './posthog.js';
