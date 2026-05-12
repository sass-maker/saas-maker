import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isLocalAuthBypassEnabled } from "@/lib/local-auth";

export const DROID_API_URL = process.env.DROID_API_URL || "https://saasmaker-droid.sarthakagrawal927.workers.dev";

export async function requireDroidAccess() {
  const requestHeaders = await headers();
  if (isLocalAuthBypassEnabled(requestHeaders.get("host"))) return null;
  const session = await auth.api.getSession({ headers: requestHeaders });
  return session?.user ? null : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function droidJsonResponse(upstream: string | URL, init: RequestInit = {}) {
  const token = process.env.DROID_INTERNAL_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "DROID_INTERNAL_TOKEN is not configured" }, { status: 500 });
  }

  const requestHeaders = new Headers(init.headers);
  requestHeaders.set("Authorization", `Bearer ${token}`);
  if (init.body && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  const response = await fetch(upstream, {
    ...init,
    headers: requestHeaders,
  });
  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }

  return NextResponse.json(data, { status: response.status });
}

export function droidApiUrl(path: string) {
  return `${DROID_API_URL}${path}`;
}
