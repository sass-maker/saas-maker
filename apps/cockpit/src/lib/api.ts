const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://api.sassmaker.com"
    : "http://localhost:8787");

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

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
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
