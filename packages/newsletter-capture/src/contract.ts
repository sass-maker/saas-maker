export const DEFAULT_API_BASE_URL = 'https://api.sassmaker.com';
export const DEFAULT_SOURCE = 'footer';
export const EMAIL_MAX_LENGTH = 254;
export const SOURCE_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;

export type CaptureKind = 'newsletter' | 'waitlist';

/** Versioned consent copy. Bump the version and server snapshot before changing it. */
export const CONSENT_COPY_V1: Readonly<Record<CaptureKind, string>> = {
  newsletter:
    'I agree to receive newsletter emails about this product. I can unsubscribe at any time.',
  waitlist:
    'I agree to receive early-access and availability emails about this product. I can unsubscribe at any time.',
};

export interface SubscriptionRequest {
  email: string;
  kind: CaptureKind;
  source: string;
  consent: true;
}

export function normalizeApiBaseUrl(value: string, _pageUrl?: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('The subscription API URL cannot be empty.');

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('The subscription API URL is invalid.');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('The subscription API URL must use HTTP or HTTPS.');
  }
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('The subscription API URL must use HTTPS outside local development.');
  }
  if (url.username || url.password) {
    throw new Error('The subscription API URL cannot include credentials.');
  }
  if (url.search || url.hash) {
    throw new Error('The subscription API URL cannot include a query or fragment.');
  }
  if (url.pathname !== '/') {
    throw new Error('The subscription API URL must be an origin without a path.');
  }
  if (!/^https?:\/\/[^/?#]+\/?$/i.test(trimmed)) {
    throw new Error('The subscription API URL must be an origin without a path.');
  }

  return url.origin;
}

export function validateSubscriptionRequest(
  input: Omit<SubscriptionRequest, 'consent'> & { consent: boolean }
): SubscriptionRequest {
  const email = input.email.trim().toLowerCase();
  if (email.length > EMAIL_MAX_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email address.');
  }
  if (input.kind !== 'newsletter' && input.kind !== 'waitlist') {
    throw new Error('Choose newsletter updates or the waitlist.');
  }
  const source = input.source.trim();
  if (!SOURCE_PATTERN.test(source)) {
    throw new Error('The product source must be a lowercase identifier.');
  }
  if (input.consent !== true) {
    throw new Error('Please agree to receive these emails before submitting.');
  }
  return { email, kind: input.kind, source, consent: true };
}

export async function submitSubscription(
  input: SubscriptionRequest,
  options: { projectKey: string; apiBaseUrl?: string; fetcher?: typeof fetch }
): Promise<void> {
  const projectKey = options.projectKey.trim();
  if (!projectKey) throw new Error('This signup form is not configured yet.');

  const apiBaseUrl = normalizeApiBaseUrl(options.apiBaseUrl ?? DEFAULT_API_BASE_URL);
  const fetcher = options.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher(`${apiBaseUrl}/v1/subscriptions`, {
      method: 'POST',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        'X-Project-Key': projectKey,
      },
      body: JSON.stringify(input),
    });
  } catch (error) {
    throw new Error('Unable to reach the signup service. Please try again.', { cause: error });
  }

  if (!response.ok) {
    if (response.status === 400) {
      throw new Error('Check your email and consent, then try again.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('This signup form is temporarily unavailable.');
    }
    if (response.status === 429) {
      throw new Error('Too many attempts. Please wait a moment and try again.');
    }
    throw new Error('Your request could not be sent. Please try again later.');
  }
}
