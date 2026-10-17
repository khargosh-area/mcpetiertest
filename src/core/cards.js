/**
 * Premium tier-result card renderer.
 *
 * Renders a 1200x630 PNG (via sharp) with an SVG fallback when sharp is not
 * available. Shared by the Discord bot and the dashboard card preview.
 */
import { aestheticTier, tierAccent, escapeXml } from './config.js';

let sharp = null;
try {
  ({ default: sharp } = await import('sharp'));
} catch (error) {
  console.warn('[CARD] sharp unavailable; tier cards will use SVG fallback:', error.message);
}

const SKIN_ENDPOINT = 'https://mc-heads.net/body';

/**
 * Download a Minecraft skin render as base64. Returns null when the player has
 * no skin, the network is unavailable or the request times out.
 */
export async function fetchSkin(gamertag, { timeout = 8000 } = {}) {
  try {
    const url = `${SKIN_ENDPOINT}/${encodeURIComponent(gamertag)}/right`;
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer()).toString('base64');
  } catch {
    return null;
  }
}

/**
 * Build the tier card.
 *
 * @param {object} options
 * @param {string} options.gamertag   Minecraft username
 * @param {string} options.mode       Gamemode name
 * @param {string} options.tier       Tier code (HT1, LT2, ...)
 * @param {string} [options.tester]   Tester display name
 * @param {string} [options.previousTier]
 * @param {string} [options.note]
 * @param {string} [options.region]
 * @param {string} [options.device]
 * @param {boolean} [options.withSkin] Fetch the Minecraft skin (network call)
 * @returns {Promise<{buffer: Buffer, ext: 'png'|'svg'}>}
 */
export async function buildTierCard({
  gamertag,
  mode,
  tier,
  tester = 'Unknown',
  previousTier = null,
  note = 'ggs',
  region = 'AS',
  device = 'Mobile',
  withSkin = true
}) {
  const accent = tierAccent(tier);
  const accentRgb = accent.replace('#', '');
  const testerName = typeof tester === 'string' ? tester : tester?.username || 'Unknown';

  const skinData = withSkin ? await fetchSkin(gamertag) : null;

  const skin = skinData
    ? `<image href="data:image/png;base64,${skinData}" x="70" y="95" width="330" height="470" preserveAspectRatio="xMidYMid meet"/>`
    : `<text x="235" y="315" text-anchor="middle" fill="#8b93a7" font-size="22" font-family="Arial">Minecraft Skin</text>`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0b1020"/><stop offset="100%" stop-color="#17132b"/>
      </linearGradient>
      <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0"/><stop offset="50%" stop-color="${accent}"/><stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
      </linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect width="1200" height="630" rx="32" fill="url(#bg)"/>
    <circle cx="1070" cy="80" r="170" fill="#${accentRgb}" opacity="0.08" filter="url(#glow)"/>
    <circle cx="150" cy="580" r="190" fill="#${accentRgb}" opacity="0.06" filter="url(#glow)"/>
    <rect x="28" y="28" width="1144" height="574" rx="26" fill="none" stroke="${accent}" stroke-opacity="0.35"/>
    <rect x="48" y="48" width="1104" height="4" rx="2" fill="url(#line)"/>
    ${skin}
    <text x="430" y="105" fill="#8e97ad" font-size="22" font-family="Arial, sans-serif" letter-spacing="7">TIER UPDATE</text>
    <text x="430" y="165" fill="#f7f8fb" font-size="52" font-weight="700" font-family="Arial, sans-serif">${escapeXml(gamertag)}</text>
    <text x="430" y="215" fill="${accent}" font-size="25" font-weight="700" font-family="Arial, sans-serif">${escapeXml(String(mode || '').toUpperCase())}</text>
    <text x="430" y="330" fill="${accent}" font-size="104" font-weight="900" font-family="Arial, sans-serif">${escapeXml(aestheticTier(tier))}</text>
    <text x="435" y="375" fill="#8e97ad" font-size="18" font-family="Arial, sans-serif" letter-spacing="3">${escapeXml(String(region).toUpperCase())}  •  ${escapeXml(String(device).toUpperCase())}  •  TESTED BY ${escapeXml(String(testerName).toUpperCase())}</text>
    <rect x="430" y="420" width="620" height="2" fill="#ffffff" opacity="0.12"/>
    <text x="430" y="465" fill="#b7bfd0" font-size="20" font-family="Arial, sans-serif">PREVIOUS: ${escapeXml(previousTier ? aestheticTier(previousTier) : 'UNRANKED')}</text>
    <text x="430" y="505" fill="#b7bfd0" font-size="20" font-family="Arial, sans-serif">NOTE: ${escapeXml(note || 'ggs')}</text>
    <text x="430" y="565" fill="#697287" font-size="16" font-family="Arial, sans-serif" letter-spacing="4">TIER TESTBOT • MINECRAFT PVP RANKINGS</text>
  </svg>`;

  if (sharp) {
    try {
      return { buffer: await sharp(Buffer.from(svg)).png({ quality: 95 }).toBuffer(), ext: 'png' };
    } catch (error) {
      console.error('[CARD] PNG render failed; using SVG fallback:', error.message);
    }
  }
  return { buffer: Buffer.from(svg), ext: 'svg' };
}
