import { cookies } from 'next/headers';
import { authConfigured, verifySession, SESSION_COOKIE } from './auth-core';

export * from './auth-core';

/** Server-side session check used by pages and route handlers. */
export async function isAuthenticated(): Promise<boolean> {
  if (!authConfigured()) return true; // open mode — no password set
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}
