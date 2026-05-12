import { auth } from "@/lib/auth";
import { LOCAL_ACCESS_COOKIE, getLocalProtectionToken, isLocalAuthBypassEnabled, isLocalHost } from "@/lib/local-auth";
import { NextRequest, NextResponse } from "next/server";

function authorizeProtectedLocal(req: NextRequest) {
  const expected = getLocalProtectionToken();
  if (!expected || !isLocalHost(req.headers.get("host"))) return null;

  const supplied =
    req.nextUrl.searchParams.get("local_token") ||
    req.headers.get("x-local-access-token") ||
    req.cookies.get(LOCAL_ACCESS_COOKIE)?.value;

  if (supplied === expected) {
    const url = req.nextUrl.clone();
    if (url.searchParams.has("local_token")) {
      url.searchParams.delete("local_token");
      const response = NextResponse.redirect(url);
      response.cookies.set(LOCAL_ACCESS_COOKIE, expected, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
      });
      return response;
    }
    return NextResponse.next();
  }

  return new NextResponse("Local access token required", { status: 401 });
}

function requiresLocalProtection(pathname: string): boolean {
  return pathname.startsWith("/api/droid/") || pathname === "/api/tasks/run";
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public feedback pages don't require auth
  if (pathname.match(/^\/projects\/[^/]+\/feedback/)) {
    return NextResponse.next();
  }

  if (isLocalAuthBypassEnabled(req.headers.get("host"))) {
    if (requiresLocalProtection(pathname)) {
      const localProtection = authorizeProtectedLocal(req);
      if (localProtection) return localProtection;
    }
    return NextResponse.next();
  }

  // All other /projects routes require auth
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/droid/:path*",
    "/api/tasks/run",
    "/api/token",
    "/projects/:path*",
    "/tasks/:path*",
    "/secrets/:path*",
    "/manifest/:path*",
    "/jobs/:path*",
    "/fleet/:path*",
    "/standards/:path*",
    "/roadmap/:path*",
  ],
};
