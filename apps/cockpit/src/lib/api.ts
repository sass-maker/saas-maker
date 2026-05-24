import { API_BASE } from "./api-base";

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

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fetch error";
    throw new Error(`${message} (${API_BASE}${path})`);
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
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
): Promise<import("@saas-maker/shared-types").ProjectRecord | null> {
  try {
    return await apiFetch(`/v1/projects/by-slug/${slug}`, {}, token);
  } catch {
    return null;
  }
}
