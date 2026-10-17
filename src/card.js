import { tierAccent, aestheticTier, escapeXml } from './constants.js';

let sharp = null;
try { ({ default: sharp } = await import('sharp')); } catch (e) { console.warn('[BOOT] sharp unavailable; tier cards will use SVG fallback:', e.message); }

export async function buildTierCard({ gamertag, mode, tier, tester, previousTier, note, region = 'AS', device = 'Mobile', serverName = 'Minecraft Server', date = new Date() }) {
  const accent = tierAccent(tier);
  const accentRgb = accent.replace('#','');
  let skinData = null;
  // Try multiple skin services with timeout
  const services = [
    `https://mc-heads.net/body/${encodeURIComponent(gamertag)}/right`,
    `https://visage.surgeplay.com/full/256/${encodeURIComponent(gamertag)}`,
    `https://crafatar.com/renders/body/${encodeURIComponent(gamertag)}?overlay`
  ];
  for (const url of services) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'TierTestBot/8.0' } });
      if (res.ok && (res.headers.get('content-type')||'').includes('image')) {
        skinData = Buffer.from(await res.arrayBuffer()).toString('base64');
        break;
      }
    } catch {}
  }

  const skinImg = skinData
    ? `<image href="data:image/png;base64,${skinData}" x="70" y="95" width="330" height="470" preserveAspectRatio="xMidYMid meet"/>`
    : `<text x="235" y="315" text-anchor="middle" fill="#8b93a7" font-size="22" font-family="Arial">Minecraft Skin</text><text x="235" y="340" text-anchor="middle" fill="#6b7280" font-size="14" font-family="Arial">Unavailable</text>`;

  const dateStr = date.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
  const footer = 'Made by Khargosh with ❤️';
  const serverEsc = escapeXml(serverName);
  const tierEsc = escapeXml(aestheticTier(tier));
  const modeEsc = escapeXml(mode.toUpperCase());
  const gamertagEsc = escapeXml(gamertag);
  const prevEsc = escapeXml(previousTier ? aestheticTier(previousTier) : 'UNRANKED');
  const noteEsc = escapeXml(note || 'ggs');
  const regionEsc = escapeXml(region.toUpperCase());
  const deviceEsc = escapeXml(device.toUpperCase());
  const testerEsc = escapeXml(tester?.username ? tester.username.toUpperCase() : 'UNKNOWN');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg width="1200" height="680" viewBox="0 0 1200 680" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0b1020"/><stop offset="100%" stop-color="#17132b"/>
      </linearGradient>
      <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0"/><stop offset="50%" stop-color="${accent}"/><stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
      </linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <linearGradient id="cardBg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#151a2e" stop-opacity="0.9"/><stop offset="100%" stop-color="#0f1221" stop-opacity="0.95"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="680" rx="32" fill="url(#bg)"/>
    <circle cx="1070" cy="80" r="170" fill="#${accentRgb}" opacity="0.08" filter="url(#glow)"/>
    <circle cx="150" cy="620" r="190" fill="#${accentRgb}" opacity="0.06" filter="url(#glow)"/>
    <rect x="28" y="28" width="1144" height="624" rx="26" fill="none" stroke="${accent}" stroke-opacity="0.35"/>
    <rect x="48" y="48" width="1104" height="4" rx="2" fill="url(#line)"/>
    <!-- Header server name -->
    <text x="600" y="72" text-anchor="middle" fill="#9ca3af" font-size="14" font-family="Arial, sans-serif" letter-spacing="6">${serverEsc}</text>
    ${skinImg}
    <text x="430" y="105" fill="#8e97ad" font-size="20" font-family="Arial, sans-serif" letter-spacing="7">TIER UPDATE</text>
    <text x="430" y="165" fill="#f7f8fb" font-size="52" font-weight="700" font-family="Arial, sans-serif">${gamertagEsc}</text>
    <text x="430" y="205" fill="${accent}" font-size="24" font-weight="700" font-family="Arial, sans-serif">${modeEsc}</text>
    <text x="430" y="330" fill="${accent}" font-size="104" font-weight="900" font-family="Arial, sans-serif">${tierEsc}</text>
    <text x="435" y="370" fill="#8e97ad" font-size="17" font-family="Arial, sans-serif" letter-spacing="3">${regionEsc}  •  ${deviceEsc}  •  TESTED BY ${testerEsc}</text>
    <rect x="430" y="395" width="620" height="2" fill="#ffffff" opacity="0.12"/>
    <text x="430" y="435" fill="#b7bfd0" font-size="19" font-family="Arial, sans-serif">PREVIOUS: ${prevEsc}</text>
    <text x="430" y="470" fill="#b7bfd0" font-size="19" font-family="Arial, sans-serif">NOTE: ${noteEsc}</text>
    <text x="430" y="510" fill="#9aa3b8" font-size="16" font-family="Arial, sans-serif">DATE: ${escapeXml(dateStr)}</text>
    <text x="600" y="595" text-anchor="middle" fill="#6b7280" font-size="16" font-family="Arial, sans-serif" letter-spacing="2">TIERTESTBOT • MINECRAFT PVP RANKINGS</text>
    <text x="600" y="625" text-anchor="middle" fill="#a78bfa" font-size="15" font-family="Arial, sans-serif" letter-spacing="1">${escapeXml(footer)}</text>
  </svg>`;

  if (sharp) {
    try { return { buffer: await sharp(Buffer.from(svg)).png({ quality: 95 }).toBuffer(), ext: 'png' }; }
    catch (error) { console.error('[CARD] PNG render failed; using SVG fallback:', error.message); }
  }
  return { buffer: Buffer.from(svg), ext: 'svg' };
}

// Fallback embed if card generation fails completely
export function fallbackEmbed({ gamertag, mode, tier, tester, previousTier, note, region, device }) {
  return {
    color: parseInt(tierAccent(tier).replace('#',''),16),
    title: `${mode} • ${aestheticTier(tier)}`,
    description: `**${gamertag}** achieved **${tier}** in **${mode}**\nPrevious: ${previousTier||'UNRANKED'} | Tester: ${tester?.username||'Unknown'}\nRegion: ${region} | Device: ${device}\nNote: ${note}`
  };
}
