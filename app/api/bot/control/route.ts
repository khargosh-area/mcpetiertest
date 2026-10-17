import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Asks a running bot session to stop or restart itself. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const action = body?.action;
  if (action !== 'stop' && action !== 'restart') {
    return NextResponse.json({ ok: false, error: 'action must be "stop" or "restart"' }, { status: 400 });
  }
  const store = await getStore();
  await store.set('system:control', { action, requestedAt: new Date().toISOString(), handled: false });
  return NextResponse.json({ ok: true, message: `${action} signal sent to the bot.` });
}
