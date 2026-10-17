import { after } from 'next/server';
import { runBotSession } from '@/src/core/main.js';
import { getBotState } from '@/lib/dashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Boots a Discord bot session inside this deployment.
 *
 * The response is returned immediately; the bot keeps running in the
 * background (Vercel "background function") for the length of the session
 * window. Point a Vercel cron at `/api/bot/keepalive` to keep it alive.
 */
export async function POST() {
  const bot = await getBotState();
  if (bot.online) {
    return Response.json({ ok: false, error: 'The bot is already online.' }, { status: 409 });
  }
  if (!process.env.DISCORD_TOKEN?.trim() || !process.env.CLIENT_ID?.trim()) {
    return Response.json(
      { ok: false, error: 'DISCORD_TOKEN and CLIENT_ID must be set in the environment variables.' },
      { status: 400 }
    );
  }

  after(async () => {
    const session = await runBotSession({ durationMs: 250_000, reason: 'dashboard' });
    if (!session.ok) console.error('[BOT RUNNER]', session.error);
  });

  return Response.json(
    { ok: true, message: 'Bot session starting — it stays up for ~4 minutes, then the keepalive restarts it.' },
    { status: 202 }
  );
}
