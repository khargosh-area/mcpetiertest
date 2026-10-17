import { NextResponse } from 'next/server';
import { getOverview } from '@/lib/dashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const overview = await getOverview();
  return NextResponse.json({ ok: true, ...overview });
}
