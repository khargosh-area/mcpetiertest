/**
 * Edge-safe authentication primitives.
 *
 * Kept free of `next/headers` so `middleware.ts` can verify sessions without
 * pulling server-only APIs into the edge bundle.
 */

export const SESSION_COOKIE = 'tt_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function authConfigured(): boolean {
  return Boolean(process.env.DASHBOARD_PASSWORD?.trim());
}

function sessionSecret(): string {
  if (process.env.SESSION_SECRET?.trim()) return process.env.SESSION_SECRET.trim();
  if (process.env.DASHBOARD_PASSWORD?.trim()) return `pw:${process.env.DASHBOARD_PASSWORD.trim()}`;
  return 'tiertestbot-insecure-dev-secret';
}

function b64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmac(data: string, secret: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return new Uint8Array(signature);
}

export async function signSession(ttlSeconds: number = SESSION_TTL_SECONDS): Promise<string> {
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + ttlSeconds })));
  const signature = b64urlEncode(await hmac(payload, sessionSecret()));
  return `${payload}.${signature}`;
}

export async function verifySession(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  try {
    const expected = await hmac(payload, sessionSecret());
    const given = b64urlDecode(signature);
    if (given.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i += 1) diff |= expected[i] ^ given[i];
    if (diff !== 0) return false;
    const decoded = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
    return typeof decoded.exp === 'number' && decoded.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

/** Constant-time password comparison. */
export function passwordMatches(candidate: string): boolean {
  const expected = process.env.DASHBOARD_PASSWORD?.trim();
  if (!expected) return false;
  if (candidate.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ candidate.charCodeAt(i);
  return diff === 0;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS
  };
}
