import { API_BASE, API_FALLBACK_BASES } from "./api-base";

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  token?: string
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let lastError: Error | null = null;
  for (const base of API_FALLBACK_BASES) {
    try {
      const res = await fetch(`${base}${path}`, {
        ...options,
        headers,
      });
      if (res.ok) return res.json();
      const body = await res.text();
      const retriable = res.status === 530 || body.includes("error code: 1003");
      if (!retriable || base === API_FALLBACK_BASES.at(-1)) {
        throw new Error(body);
      }
      lastError = new Error(body);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown fetch error";
      lastError = new Error(`${message} (${base}${path})`);
      if (base !== API_FALLBACK_BASES.at(-1)) continue;
    }
  }
  throw lastError ?? new Error(`Failed to fetch ${API_BASE}${path}`);
}

/**
 * Get the auth session token (server-side only).
 * Uses better-auth session token for API calls.
 */
export async function getServerToken(): Promise<string | undefined> {
  const { getLocalSessionToken, isLocalAuthBypassEnabled } = await import("./local-auth");
  const { headers } = await import("next/headers");
  const requestHeaders = await headers();
  if (isLocalAuthBypassEnabled(requestHeaders.get("host"))) {
    return getLocalSessionToken();
  }

  const { auth } = await import("./auth");
  const session = await auth.api.getSession({ headers: requestHeaders });
  return session?.session?.token;
}

/**
 * Resolve a project by slug (single API call instead of fetching all projects).
 * Server-side only.
 */
export async function getProjectBySlug(
  slug: string,
  token?: string
): Promise<import("@saas-maker/contracts").ProjectRecord | null> {
  try {
    return await apiFetch(`/v1/projects/by-slug/${slug}`, {}, token);
  } catch {
    return null;
  }
}
