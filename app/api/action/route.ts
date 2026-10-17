import { NextResponse } from 'next/server';
import { getStore, enqueueAction } from '@/lib/store';
import { isValidMode, isValidTier, MODES } from '@/src/core/config.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['assignTier', 'syncSetup', 'postPanels', 'approveApplication', 'rejectApplication']);

/** Queues an action for the bot to execute (the bot polls the queue). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const type = body?.type;
  if (!ALLOWED.has(type)) {
    return NextResponse.json({ ok: false, error: 'Unsupported action type.' }, { status: 400 });
  }

  const guildId = body?.guildId;
  if (!guildId) {
    return NextResponse.json({ ok: false, error: 'guildId is required.' }, { status: 400 });
  }

  const payload = body?.payload || {};

  if (type === 'assignTier') {
    if (!payload.userId) {
      return NextResponse.json({ ok: false, error: 'A Discord user id is required.' }, { status: 400 });
    }
    if (!isValidMode(payload.mode) || !isValidTier(payload.tier)) {
      return NextResponse.json({ ok: false, error: 'Unknown mode or tier.' }, { status: 400 });
    }
  }

  if (type === 'approveApplication' || type === 'rejectApplication') {
    if (!payload.applicationId) {
      return NextResponse.json({ ok: false, error: 'applicationId is required.' }, { status: 400 });
    }
  }

  const store = await getStore();
  const action = await enqueueAction(store, {
    type,
    guildId,
    payload,
    requestedBy: body?.requestedBy || 'dashboard'
  });

  return NextResponse.json({ ok: true, action, message: `Queued ${type}.` }, { status: 202 });
}

export async function GET() {
  return NextResponse.json({ ok: true, modes: MODES });
}
