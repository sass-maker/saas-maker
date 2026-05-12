import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isLocalAuthBypassEnabled } from "@/lib/local-auth";

export const dynamic = "force-dynamic";

const DROID_API_URL = process.env.DROID_API_URL || "https://saasmaker-droid.sarthakagrawal927.workers.dev";

async function assertAuthorized() {
  const requestHeaders = await headers();
  if (isLocalAuthBypassEnabled(requestHeaders.get("host"))) return true;
  const session = await auth.api.getSession({ headers: requestHeaders });
  return Boolean(session?.user);
}

export async function GET(req: Request) {
  if (!(await assertAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.DROID_INTERNAL_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "DROID_INTERNAL_TOKEN is not configured" }, { status: 500 });
  }

  const url = new URL(req.url);
  const upstream = new URL(`${DROID_API_URL}/v0/debug/sandbox`);
  for (const key of ["id", "destroy"]) {
    const value = url.searchParams.get(key);
    if (value) upstream.searchParams.set(key, value);
  }

  const response = await fetch(upstream, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({ error: "Invalid Droid response" }));
  return NextResponse.json(payload, { status: response.status });
}
