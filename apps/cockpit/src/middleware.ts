import { isLocalAuthBypassEnabled } from '@/lib/local-auth-edge';
import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIES = ['better-auth.session_token', '__Secure-better-auth.session_token'];

function hasSessionCookie(req: NextRequest): boolean {
  return SESSION_COOKIES.some((name) => Boolean(req.cookies.get(name)?.value));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const scoreboard =
    pathname === '/projects' && req.nextUrl.searchParams.get('view') === 'scoreboard';
  const requestHeaders = new Headers(req.headers);
  requestHeaders.delete('x-saasmaker-private-surface');
  if (scoreboard) requestHeaders.set('x-saasmaker-private-surface', 'scoreboard');
  const proceed = () => {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    if (scoreboard) {
      response.headers.set('Cache-Control', 'private, no-store');
      response.headers.set('Referrer-Policy', 'no-referrer');
      response.headers.set(
        'Content-Security-Policy',
        "connect-src 'self'; frame-src 'none'; form-action 'self'"
      );
    }
    return response;
  };

  if (isLocalAuthBypassEnabled(req.headers.get('host'))) {
    return proceed();
  }

  // Do not call better-auth here. Middleware runs on the Edge isolate and
  // getCloudflareContext()/D1 are unavailable, which 500s /projects.
  if (!hasSessionCookie(req)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const login = new URL('/login', req.url);
    if (scoreboard) login.searchParams.set('returnTo', 'scoreboard');
    return NextResponse.redirect(login);
  }

  return proceed();
}

export const config = {
  matcher: ['/api/token', '/projects', '/projects/:path*'],
};
