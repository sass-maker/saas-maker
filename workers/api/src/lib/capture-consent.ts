import type { CaptureKind } from './capture-store';

/** Immutable server snapshot of the checkbox wording shipped with capture v1. */
export const CAPTURE_CONSENT_VERSION = 'v1';
export const CAPTURE_CONSENT_COPY_V1: Readonly<Record<CaptureKind, string>> = {
  newsletter:
    'I agree to receive newsletter emails about this product. I can unsubscribe at any time.',
  waitlist:
    'I agree to receive early-access and availability emails about this product. I can unsubscribe at any time.',
};
