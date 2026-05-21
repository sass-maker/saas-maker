"use client";

/**
 * Owner-facing analytics — the fixed 4-event taxonomy.
 *
 * Every fleet project emits exactly these four events — `signup`, `activated`,
 * `core_action`, `returned` — so a single PostHog project can build one
 * cross-fleet funnel (signup -> activated -> core_action) and a D1/D7
 * retention insight, with no custom dashboard. Every event carries a
 * `project` property.
 *
 * The cockpit does NOT ship `@saas-maker/posthog-client`. Like
 * `capture-error.ts`, it routes through the SaaS Maker SDK
 * (`getSaasmaker().analytics.track`) — the cockpit's existing analytics path,
 * already wired in `SaasMakerAnalytics.tsx`. The taxonomy is namespaced under
 * the `name` field; the canonical event and `project` ride in `properties` so
 * the cross-fleet funnel still keys on them.
 *
 * Analytics must NEVER break a user flow — every call here is wrapped and
 * best-effort.
 */

import { getSaasmaker } from "@/lib/saasmaker";

const PROJECT = "saas-maker" as const;

/** The product-specific action behind a `core_action` event. */
export type CoreAction = "project_created" | "task_created";

type AnalyticsEvent = "signup" | "activated" | "core_action" | "returned";

const SIGNUP_KEY = "saasmaker_signup_done";
const ACTIVATED_KEY = "saasmaker_activated";
const SESSION_KEY = "saasmaker_session_seen";

function route(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}${window.location.pathname}`;
}

/** Fire-and-forget emit. Best-effort: never blocks or throws into a flow. */
function emit(event: AnalyticsEvent, properties: Record<string, unknown> = {}): void {
  try {
    void getSaasmaker()
      .analytics.track({
        name: event,
        url: route(),
        properties: { project: PROJECT, event, ...properties },
      })
      .catch(() => {
        // Swallow — analytics is best-effort only.
      });
  } catch {
    // SDK not configured (missing api key) — analytics disabled. Never throw.
  }
}

/**
 * Fire on a session start. Emits `signup` once on the first ever session
 * (account creation), and `returned` on every later session for a user who
 * already has prior activity. Self-dedupes per session via sessionStorage and
 * per user via localStorage. Safe to call on every app mount.
 */
export function trackSession(): void {
  try {
    // One emit per browser session.
    if (sessionStorage.getItem(SESSION_KEY) === "true") return;
    sessionStorage.setItem(SESSION_KEY, "true");

    if (localStorage.getItem(SIGNUP_KEY) !== "true") {
      localStorage.setItem(SIGNUP_KEY, "true");
      emit("signup");
      return;
    }
    // Returning user — only counts if they have prior real activity.
    if (localStorage.getItem(ACTIVATED_KEY) === "true") {
      emit("returned");
    }
  } catch {
    // sessionStorage/localStorage unavailable — analytics is best-effort.
  }
}

/**
 * Fire when the user completes a core cockpit action. On the user's FIRST
 * core action this also emits `activated` (first real value — they are now
 * operating the fleet, not just looking at it).
 */
export function trackCoreAction(action: CoreAction): void {
  try {
    if (localStorage.getItem(ACTIVATED_KEY) !== "true") {
      localStorage.setItem(ACTIVATED_KEY, "true");
      emit("activated", { action });
    }
  } catch {
    // Ignore — still emit the core_action below.
  }
  emit("core_action", { action });
}
