import { NextResponse } from 'next/server';
import { readAllGuildConfigs, readLogEntries } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Full data export — handy for backups and migrations. */
export async function GET() {
  const [guilds, logs] = await Promise.all([readAllGuildConfigs(), readLogEntries(500)]);
  return new NextResponse(
    JSON.stringify({ exportedAt: new Date().toISOString(), guilds, logs }, null, 2),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="tiertestbot-export-${Date.now()}.json"`
      }
    }
  );
}
