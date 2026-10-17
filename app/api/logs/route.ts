import { NextResponse } from 'next/server';
import { readLogEntries } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(500, Number(url.searchParams.get('limit') || 200));
  const since = url.searchParams.get('since') || undefined;
  const entries = await readLogEntries(limit, since);
  return NextResponse.json({ ok: true, entries });
}
