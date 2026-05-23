import { NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE = 'nb_auth';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public paths: the login page itself and the login endpoint
  if (
    pathname === '/login' ||
    pathname === '/api/login' ||
    pathname.startsWith('/_next') ||
    pathname === '/manifest.json' ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  const expected = process.env.APP_PASSWORD;

  // If no password is set on the server, allow through (dev fallback)
  if (!expected) return NextResponse.next();

  if (cookie === expected) {
    return NextResponse.next();
  }

  // API calls get a 401 JSON, page navigations get redirected
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
