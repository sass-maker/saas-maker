const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

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
 * Get the auth token from cookies (server-side only).
 * Import `cookies` from `next/headers` before calling this.
 */
export async function getServerToken(): Promise<string | undefined> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  return (
    cookieStore.get("__Secure-authjs.session-token")?.value ??
    cookieStore.get("authjs.session-token")?.value
  );
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
