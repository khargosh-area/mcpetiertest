import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, passwordMatches, signSession, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const password = (form?.get('password') as string | null) ?? '';

  if (!authConfigured()) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  if (!passwordMatches(password)) {
    return NextResponse.redirect(new URL('/login?error=1', request.url));
  }

  const token = await signSession();
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions());
  return NextResponse.redirect(new URL('/', request.url));
}
