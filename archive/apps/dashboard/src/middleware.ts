import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Public feedback pages don't require auth
  if (pathname.match(/^\/projects\/[^/]+\/feedback/)) {
    return NextResponse.next();
  }

  // All other /projects routes require auth
  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = { matcher: ["/projects/:path*"] };
