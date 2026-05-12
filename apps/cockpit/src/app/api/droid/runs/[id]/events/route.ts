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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await assertAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.DROID_INTERNAL_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "DROID_INTERNAL_TOKEN is not configured" }, { status: 500 });
  }

  const { id } = await params;
  const response = await fetch(`${DROID_API_URL}/v0/runs/${encodeURIComponent(id)}/events`, {
    headers: { Authorization: `Bearer ${token}` },
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
