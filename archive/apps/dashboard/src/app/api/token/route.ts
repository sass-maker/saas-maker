import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Returns the raw Auth.js session token (encrypted JWE) for use as
 * a Bearer token when calling the Workers API directly from the client.
 *
 * Only returns the token if the user has a valid Auth.js session.
 */
export async function GET() {
  // Verify the user actually has a valid session
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const cookieStore = await cookies();

  // Auth.js v5 cookie names:
  // - Development: "authjs.session-token"
  // - Production (HTTPS): "__Secure-authjs.session-token"
  const token =
    cookieStore.get("__Secure-authjs.session-token")?.value ??
    cookieStore.get("authjs.session-token")?.value;

  if (!token) {
    return NextResponse.json({ error: "No session token" }, { status: 401 });
  }

  return NextResponse.json({ token });
}
