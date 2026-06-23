'use client';

type ErrorBoundaryScope =
  | 'root'
  | 'global'
  | 'projects'
  | 'project-detail'
  | 'jobs'
  | 'fleet'
  | 'tasks'
  | 'unknown';

function route() {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}${window.location.pathname}`;
}

function _messageFrom(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

/**
 * Records an error surfaced by a React error boundary (error.tsx /
 * global-error.tsx). Full detail stays in the console and never reaches the
 * user-facing error view.
 */
export function captureError(
  error: unknown,
  options: { scope?: ErrorBoundaryScope; digest?: string; source?: string } = {}
) {
  const context = {
    scope: options.scope ?? 'unknown',
    source: options.source ?? 'error_boundary',
    digest: options.digest,
    route: route(),
  };

  // Full detail goes to the console — never to the user.
  console.error('[cockpit:error]', context, error);
}
