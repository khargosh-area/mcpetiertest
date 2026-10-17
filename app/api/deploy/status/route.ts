import { NextResponse } from 'next/server';
import { getVercelStatus } from '@/lib/vercel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const status = await getVercelStatus();
  return NextResponse.json({ ok: true, ...status });
}
