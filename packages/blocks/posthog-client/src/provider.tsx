/**
 * <PostHogProvider> — initializes the browser client + exposes via context.
 * usePostHog() hook for accessing the live instance from React components.
 */

import { createContext, useContext, useEffect, useMemo, useRef, type ReactElement, type ReactNode } from 'react';
import type { PostHog } from 'posthog-js';
import { getPostHog, initPostHog } from './client.js';
import type { PostHogClientConfig } from './types.js';

const PostHogContext = createContext<PostHog | null>(null);

export interface PostHogProviderProps extends Partial<PostHogClientConfig> {
  children: ReactNode;
}

export function PostHogProvider({ children, ...config }: PostHogProviderProps): ReactElement {
  const initRef = useRef(false);

  // Initialize once on mount (client only).
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    initPostHog(config);
    // We deliberately ignore deps — config is captured on first mount.
    // Reinitialization mid-session would orphan in-flight events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => getPostHog(), []);

  return <PostHogContext.Provider value={value}>{children}</PostHogContext.Provider>;
}

export function usePostHog(): PostHog | null {
  return useContext(PostHogContext) ?? getPostHog();
}
