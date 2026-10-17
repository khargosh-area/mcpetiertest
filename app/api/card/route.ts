import { buildTierCard } from '@/src/core/cards.js';
import { isValidMode, isValidTier, MODES, TIERS } from '@/src/core/config.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Renders a tier card preview — used by the dashboard card designer. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const gamertag = (url.searchParams.get('gamertag') || 'Notch').slice(0, 24);
  const mode = url.searchParams.get('mode') || 'Sword';
  const tier = (url.searchParams.get('tier') || 'HT1').toUpperCase();
  const tester = (url.searchParams.get('tester') || 'Dashboard').slice(0, 32);
  const region = (url.searchParams.get('region') || 'AS').slice(0, 12);
  const device = (url.searchParams.get('device') || 'Mobile').slice(0, 16);
  const note = (url.searchParams.get('note') || 'ggs').slice(0, 60);

  if (!isValidMode(mode) || !isValidTier(tier)) {
    return Response.json({ ok: false, error: `mode must be one of ${MODES.join(', ')}; tier one of ${TIERS.join(', ')}` }, { status: 400 });
  }

  const image = await buildTierCard({ gamertag, mode, tier, tester, previousTier: null, note, region, device });
  return new Response(new Uint8Array(image.buffer), {
    headers: {
      'Content-Type': image.ext === 'png' ? 'image/png' : 'image/svg+xml',
      'Cache-Control': 'no-store'
    }
  });
}
