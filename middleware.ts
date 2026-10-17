import { NextResponse, type NextRequest } from 'next/server';
import { authConfigured, verifySession, SESSION_COOKIE } from '@/lib/auth-core';

/**
 * Protects every page and API route with the dashboard password.
 * When no password is configured the panel stays open (read-only mode).
 */
export async function middleware(request: NextRequest) {
  if (!authConfigured()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === '/login' || pathname.startsWith('/api/auth/')) return NextResponse.next();
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySession(token)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)']
};
