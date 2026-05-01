import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getLocalSessionToken, isLocalAuthBypassEnabled } from "@/lib/local-auth";

/**
 * Returns the better-auth session token for use as a Bearer token
 * when calling the Workers API directly from the client.
 *
 * Only returns the token if the user has a valid session.
 */
export async function GET() {
  const requestHeaders = await headers();
  if (isLocalAuthBypassEnabled(requestHeaders.get("host"))) {
    return NextResponse.json({ token: getLocalSessionToken() });
  }

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const token = session.session?.token;
  if (!token) {
    return NextResponse.json({ error: "No session token" }, { status: 401 });
  }

  return NextResponse.json({ token });
}
