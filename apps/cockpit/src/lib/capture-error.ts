"use client";

import { getSaasmaker } from "@/lib/saasmaker";

type ErrorBoundaryScope =
  | "root"
  | "global"
  | "projects"
  | "project-detail"
  | "jobs"
  | "fleet"
  | "tasks"
  | "unknown";

function route() {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}${window.location.pathname}`;
}

function messageFrom(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

/**
 * Records an error surfaced by a React error boundary (error.tsx /
 * global-error.tsx). Cockpit does not ship `@saas-maker/posthog-client`, so
 * this logs structured context to the console and best-effort-tracks an
 * `error_boundary` event via the SaaS Maker SDK. Never throws — safe to call
 * from inside an error boundary.
 */
export function captureError(
  error: unknown,
  options: { scope?: ErrorBoundaryScope; digest?: string; source?: string } = {},
) {
  const context = {
    scope: options.scope ?? "unknown",
    source: options.source ?? "error_boundary",
    digest: options.digest,
    route: route(),
  };

  // Full detail goes to the console — never to the user.
  console.error("[cockpit:error]", context, error);

  try {
    getSaasmaker().analytics.track({
      name: "error_boundary",
      url: route(),
      properties: {
        scope: context.scope,
        source: context.source,
        digest: context.digest,
        message: messageFrom(error),
      },
    });
  } catch {
    // SDK not configured (missing api key) or boundary running — never let
    // monitoring throw inside an error boundary.
  }
}
