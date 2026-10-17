import { after } from 'next/server';
import { runBotSession } from '@/src/core/main.js';
import { getBotState } from '@/lib/dashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Keeps the bot alive.
 *
 * Safe to call from a Vercel cron (every few minutes) or an external uptime
 * pinger. It only starts a new session when the bot is not already running.
 */
async function handle() {
  const bot = await getBotState();
  if (bot.online) {
    return Response.json({ ok: true, message: 'Bot already online.', started: false });
  }
  if (!process.env.DISCORD_TOKEN?.trim() || !process.env.CLIENT_ID?.trim()) {
    return Response.json({ ok: false, error: 'DISCORD_TOKEN / CLIENT_ID missing.' }, { status: 400 });
  }

  after(async () => {
    const session = await runBotSession({ durationMs: 245_000, reason: 'keepalive' });
    if (!session.ok) console.error('[KEEPALIVE]', session.error);
  });

  return Response.json({ ok: true, message: 'Bot session starting.', started: true }, { status: 202 });
}

export const GET = handle;
export const POST = handle;
