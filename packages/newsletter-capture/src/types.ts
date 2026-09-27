import type { CaptureKind } from './contract';

export interface NewsletterCaptureProps {
  /** Product identity shown in the form heading and consent statement. */
  productName: string;
  /**
   * Publishable SaaS Maker project key for this product. Takes precedence over
   * `catalogId` when both are present. Omit to resolve the key from `catalogId`.
   */
  projectKey?: string;
  /**
   * Canonical Fleet catalog id bound to a SaaS Maker project. The element
   * resolves the publishable key via GET /v1/capture-config/:catalogId before
   * the first submit. Ignored when `projectKey` is set.
   */
  catalogId?: string;
  /** Initial selection. Visitors can change this in the form. */
  kind?: CaptureKind;
  /** Let visitors choose either kind instead of fixing this embed to `kind`. */
  allowKindSelection?: boolean;
  /** Lowercase source identifier accepted by the subscriptions API. */
  source?: string;
  /** Defaults to https://api.sassmaker.com. Use an HTTPS origin for alternate APIs. */
  apiBaseUrl?: string;
  /** Optional link to the product's privacy policy. */
  privacyUrl?: string;
  /** Optional section label for the assistive technology region. */
  label?: string;
  /** Optional host-aware light or dark semantic defaults. */
  theme?: 'light' | 'dark';
  /** Optional class applied to the custom element host. */
  className?: string;
}
