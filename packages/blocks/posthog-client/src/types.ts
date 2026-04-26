/**
 * Generic event registry pattern.
 * Consumers extend BaseEventMap with their typed event payloads.
 */

export interface BaseEventMap {
  [event: string]: Record<string, unknown> | undefined;
}

/**
 * Helper to type-check event names + properties at the call site.
 *
 * @example
 * ```ts
 * interface MyEvents extends BaseEventMap {
 *   feedback_submitted: { project_id: string; type: 'bug' | 'feature' };
 *   user_signed_in: { method: 'google' | 'github' };
 * }
 *
 * track<MyEvents>('feedback_submitted', { project_id: 'p1', type: 'bug' });
 * ```
 */
export type EventName<E extends BaseEventMap> = Extract<keyof E, string>;
export type EventProps<E extends BaseEventMap, K extends EventName<E>> = E[K];

export interface PostHogClientConfig {
  /** PostHog project API key (NEXT_PUBLIC_POSTHOG_KEY). */
  apiKey: string;
  /** Ingest host. Defaults to https://us.i.posthog.com. */
  host?: string;
  /** Disable autocapture. Default: true (opt-in autocapture). */
  autocapture?: boolean;
  /** Default super-properties merged into every event. */
  superProperties?: Record<string, unknown>;
  /** Disable in dev. Default: false. */
  disabled?: boolean;
}
