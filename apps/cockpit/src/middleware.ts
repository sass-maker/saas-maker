import { auth } from "@/lib/auth";
import { isLocalAuthBypassEnabled } from "@/lib/local-auth";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public feedback pages don't require auth
  if (pathname.match(/^\/projects\/[^/]+\/feedback/)) {
    return NextResponse.next();
  }

  if (isLocalAuthBypassEnabled(req.headers.get("host"))) {
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
