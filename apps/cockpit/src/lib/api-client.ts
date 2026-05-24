import { API_BASE } from "./api-base";

/** Server-side fetch with session token auto-attached */
export async function apiFetchAuthed<T>(path: string, init?: RequestInit): Promise<T> {
  const { getServerToken } = await import("./api");
  const token = await getServerToken();

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers as Record<string, string>),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fetch error";
    throw new Error(`${message} (${API_BASE}${path})`);
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

/** Client-side fetch — pass token from getClientToken() */
export async function apiFetchClient<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers as Record<string, string>),
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fetch error";
    throw new Error(`${message} (${API_BASE}${path})`);
  }
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
