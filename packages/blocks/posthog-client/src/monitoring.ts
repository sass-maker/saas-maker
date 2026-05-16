import { initPostHog, track } from './client.js';
import type { BaseEventMap, PostHogClientConfig } from './types.js';

const SECRET_KEY_RE = /(authorization|cookie|credential|key|password|secret|token)/i;
const MAX_STRING_LENGTH = 500;
const MAX_STACK_LENGTH = 2000;
const MAX_DEPTH = 4;

export interface FoundryMonitoringEvents extends BaseEventMap {
  foundry_page_crash: {
    project_slug?: string;
    environment?: string;
    release?: string;
    route?: string;
    source: 'window_error' | 'unhandled_rejection' | 'manual';
    error_name?: string;
    message?: string;
    stack?: string;
    component_stack?: string;
  };
  foundry_auth_failure: {
    project_slug?: string;
    environment?: string;
    release?: string;
    route?: string;
    provider?: string;
    stage: 'signin' | 'signup' | 'callback' | 'session' | 'unknown';
    status_code?: number;
    reason?: string;
    source?: string;
  };
  foundry_signup_failure: {
    project_slug?: string;
    environment?: string;
    release?: string;
    route?: string;
    provider?: string;
    status_code?: number;
    reason?: string;
    source?: string;
  };
}

export interface MonitoringContext {
  projectSlug?: string;
  environment?: string;
  release?: string;
  route?: string;
}

interface MonitoringEventContext {
  project_slug?: string;
  environment?: string;
  release?: string;
  route?: string;
}

export interface BrowserMonitoringOptions extends MonitoringContext {
  posthog?: Partial<PostHogClientConfig>;
  captureUnhandledRejections?: boolean;
  captureWindowErrors?: boolean;
}

export interface CapturePageCrashOptions extends MonitoringContext {
  source?: FoundryMonitoringEvents['foundry_page_crash']['source'];
  componentStack?: string;
  extra?: Record<string, unknown>;
}

export interface CaptureAuthFailureOptions extends MonitoringContext {
  provider?: string;
  stage?: FoundryMonitoringEvents['foundry_auth_failure']['stage'];
  statusCode?: number;
  reason?: string;
  source?: string;
  extra?: Record<string, unknown>;
}

export interface CaptureSignupFailureOptions
  extends Omit<CaptureAuthFailureOptions, 'stage'> {}

let activeTeardown: (() => void) | null = null;

export function installBrowserMonitoring(options: BrowserMonitoringOptions = {}): () => void {
  if (typeof window === 'undefined') return noop;

  activeTeardown?.();
  initPostHog(options.posthog ?? {});

  const captureWindowErrors = options.captureWindowErrors ?? true;
  const captureUnhandledRejections = options.captureUnhandledRejections ?? true;
  const listeners: Array<() => void> = [];

  if (captureWindowErrors) {
    const onError = (event: ErrorEvent) => {
      capturePageCrash(event.error ?? event.message, {
        ...options,
        source: 'window_error',
      });
    };
    window.addEventListener('error', onError);
    listeners.push(() => window.removeEventListener('error', onError));
  }

  if (captureUnhandledRejections) {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      capturePageCrash(event.reason, {
        ...options,
        source: 'unhandled_rejection',
      });
    };
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    listeners.push(() => window.removeEventListener('unhandledrejection', onUnhandledRejection));
  }

  activeTeardown = () => {
    for (const remove of listeners) remove();
    activeTeardown = null;
  };
  return activeTeardown;
}

export function capturePageCrash(error: unknown, options: CapturePageCrashOptions = {}): void {
  const normalized = normalizeError(error);
  track<FoundryMonitoringEvents>('foundry_page_crash', {
    ...monitoringContext(options),
    source: options.source ?? 'manual',
    error_name: normalized.name,
    message: normalized.message,
    stack: normalized.stack,
    component_stack: truncate(options.componentStack, MAX_STACK_LENGTH),
    ...sanitizeMonitoringProperties(options.extra),
  });
}

export function captureAuthFailure(options: CaptureAuthFailureOptions = {}): void {
  track<FoundryMonitoringEvents>('foundry_auth_failure', {
    ...monitoringContext(options),
    provider: truncate(options.provider, MAX_STRING_LENGTH),
    stage: options.stage ?? 'unknown',
    status_code: options.statusCode,
    reason: truncate(options.reason, MAX_STRING_LENGTH),
    source: truncate(options.source, MAX_STRING_LENGTH),
    ...sanitizeMonitoringProperties(options.extra),
  });
}

export function captureSignupFailure(options: CaptureSignupFailureOptions = {}): void {
  const payload = {
    ...monitoringContext(options),
    provider: truncate(options.provider, MAX_STRING_LENGTH),
    status_code: options.statusCode,
    reason: truncate(options.reason, MAX_STRING_LENGTH),
    source: truncate(options.source, MAX_STRING_LENGTH),
    ...sanitizeMonitoringProperties(options.extra),
  };
  track<FoundryMonitoringEvents>('foundry_signup_failure', payload);
  captureAuthFailure({ ...options, stage: 'signup' });
}

export function sanitizeMonitoringProperties(
  value: unknown,
): Record<string, unknown> | undefined {
  const sanitized = sanitizeValue(value, 0);
  if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) return undefined;
  return sanitized as Record<string, unknown>;
}

function monitoringContext(options: MonitoringContext): MonitoringEventContext {
  return {
    project_slug: truncate(options.projectSlug, MAX_STRING_LENGTH),
    environment: truncate(options.environment, MAX_STRING_LENGTH),
    release: truncate(options.release, MAX_STRING_LENGTH),
    route: truncate(sanitizeRoute(options.route ?? currentRoute()), MAX_STRING_LENGTH),
  };
}

function normalizeError(error: unknown): {
  name?: string;
  message?: string;
  stack?: string;
} {
  if (error instanceof Error) {
    return {
      name: truncate(error.name, MAX_STRING_LENGTH),
      message: truncate(error.message, MAX_STRING_LENGTH),
      stack: truncate(error.stack, MAX_STACK_LENGTH),
    };
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    return {
      name: typeof record['name'] === 'string' ? truncate(record['name'], MAX_STRING_LENGTH) : undefined,
      message:
        typeof record['message'] === 'string'
          ? truncate(record['message'], MAX_STRING_LENGTH)
          : truncate(String(error), MAX_STRING_LENGTH),
      stack: typeof record['stack'] === 'string' ? truncate(record['stack'], MAX_STACK_LENGTH) : undefined,
    };
  }

  return { message: truncate(String(error), MAX_STRING_LENGTH) };
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return '[truncated]';
  if (value == null) return value;
  if (typeof value === 'string') return truncate(value, MAX_STRING_LENGTH);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) return normalizeError(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, depth + 1));
  if (typeof value !== 'object') return undefined;

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SECRET_KEY_RE.test(key) ? '[redacted]' : sanitizeValue(nested, depth + 1);
  }
  return output;
}

function currentRoute(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}${window.location.pathname}`;
}

function sanitizeRoute(route: string | undefined): string | undefined {
  if (!route) return route;
  try {
    const parsed = new URL(route, typeof window === 'undefined' ? 'https://local.invalid' : window.location.origin);
    if (/^https?:\/\//i.test(route)) {
      return `${parsed.origin}${parsed.pathname}`;
    }
    return parsed.pathname;
  } catch {
    return route.split(/[?#]/, 1)[0];
  }
}

function truncate(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return value;
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function noop(): void {}
