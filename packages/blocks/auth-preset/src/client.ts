/**
 * Browser entrypoint — better-auth React client + <AuthProvider> + useSession() hook.
 */

import { createContext, createElement, useContext, type ReactNode } from 'react';
import { createAuthClient } from 'better-auth/react';

declare const process: { env?: Record<string, string | undefined> } | undefined;

export interface AuthClientOpts {
  /** baseURL of your auth-bearing app. Falls back to window.location.origin or AUTH_URL. */
  baseURL?: string;
}

function resolveBaseURL(opts: AuthClientOpts = {}): string | undefined {
  if (opts.baseURL) return opts.baseURL;
  if (typeof window !== 'undefined') return window.location.origin;
  if (typeof process !== 'undefined') {
    return process.env?.['AUTH_URL'] ?? process.env?.['NEXTAUTH_URL'];
  }
  return undefined;
}

export function createFoundryAuthClient(opts: AuthClientOpts = {}) {
  return createAuthClient({ baseURL: resolveBaseURL(opts) });
}

export type FoundryAuthClient = ReturnType<typeof createFoundryAuthClient>;

const AuthClientContext = createContext<FoundryAuthClient | null>(null);

export interface AuthProviderProps extends AuthClientOpts {
  client?: FoundryAuthClient;
  children: ReactNode;
}

/**
 * Provides a single auth client instance to the React tree.
 * Pass an existing `client` to share with non-React code, or let the provider create one.
 */
export function AuthProvider({ client, children, ...opts }: AuthProviderProps) {
  const value = client ?? createFoundryAuthClient(opts);
  return createElement(AuthClientContext.Provider, { value }, children);
}

export function useAuthClient(): FoundryAuthClient {
  const ctx = useContext(AuthClientContext);
  if (!ctx) {
    throw new Error('useAuthClient() called outside <AuthProvider>');
  }
  return ctx;
}

/**
 * Returns the current session via better-auth's useSession.
 */
export function useSession() {
  const client = useAuthClient();
  return client.useSession();
}
