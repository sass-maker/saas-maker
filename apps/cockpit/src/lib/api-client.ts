const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://api.sassmaker.com"
    : "http://localhost:8787");

/** Server-side fetch with session token auto-attached */
export async function apiFetchAuthed<T>(path: string, init?: RequestInit): Promise<T> {
  const { getServerToken } = await import("./api");
  const token = await getServerToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string>),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

/** Client-side fetch — pass token from getClientToken() */
export async function apiFetchClient<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string>),
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

/** Get auth token from client-side /api/token endpoint */
export async function getClientToken(): Promise<string> {
  const res = await fetch("/api/token");
  if (!res.ok) throw new Error("Failed to get auth token");
  const data = await res.json();
  return data.token;
}
