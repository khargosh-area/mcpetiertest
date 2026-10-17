/**
 * Shared, dependency-free configuration for TierTestBot.
 *
 * This module is imported by BOTH the Discord bot (plain Node ESM) and the
 * dashboard (Next.js), so it must never import anything Node/Discord specific.
 */

/** Minecraft PvP testing modes the bot supports. */
export const MODES = [
  'Sword',
  'Axe',
  'Mace',
  'UHC',
  'Pot',
  'NethPot',
  'SMP',
  'Crystal',
  'Bedrock',
  'Combo'
];

/** Tier ladder, best first. Index in this array == rank. */
export const TIERS = ['HT1', 'LT1', 'HT2', 'LT2', 'HT3', 'LT3', 'HT4', 'LT4', 'HT5', 'LT5'];

/** Tiers that get highlighted in the "high tier" channel. */
export const HIGH_TIERS = ['HT1', 'LT1', 'HT2', 'LT2'];

export const MODE_ICONS = {
  Sword: '⚔️', Axe: '🪓', Mace: '🔨', UHC: '❤️', Pot: '🧪',
  NethPot: '💥', SMP: '🛡️', Crystal: '💎', Bedrock: '🪨', Combo: '⚡'
};

/** Optional Discord application emojis — falls back to unicode when missing. */
export const APP_EMOJIS = {
  sword: 'tt_sword', axe: 'tt_axe', mace: 'tt_mace', uhc: 'tt_heart',
  pot: 'tt_pot', nethpot: 'tt_fire', smp: 'tt_shield', crystal: 'tt_crystal',
  bedrock: 'tt_bedrock', combo: 'tt_combo', tier: 'tt_tier', tester: 'tt_tester',
  player: 'tt_player', note: 'tt_note', stats: 'tt_stats'
};

export const TIER_COLORS = {
  HT1: '#ff4d67', LT1: '#ff6b81', HT2: '#ff9f43', LT2: '#ffb35c',
  HT3: '#ffd166', LT3: '#ffe08a', HT4: '#56d6ff', LT4: '#7de0ff',
  HT5: '#a78bfa', LT5: '#c4b5fd'
};

export const BRAND = {
  name: 'TierTestBot',
  tagline: 'Minecraft PvP tier testing',
  version: '6.2.0',
  accent: '#7c3aed',
  accentSoft: '#a78bfa'
};

const SUPERSCRIPTS = { '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵' };

/** `HT3` -> `ʜᴛ³` (the in-Discord "aesthetic" tier style). */
export function aestheticTier(tier) {
  const m = String(tier || '').match(/^(HT|LT)([1-5])$/i);
  return m ? `ʜ${m[1][1].toLowerCase()}${SUPERSCRIPTS[m[2]]}` : String(tier || '');
}

/** Accent colour for a tier, used by cards and the dashboard. */
export function tierAccent(tier) {
  return TIER_COLORS[tier] || '#7c3aed';
}

/** `Sword` -> `sᴡᴏʀᴅ` */
export function aestheticMode(mode) {
  return String(mode || '').toLowerCase()
    .replace('sword', 'sᴡᴏʀᴅ').replace('axe', 'ᴀxᴇ').replace('mace', 'ᴍᴀᴄᴇ')
    .replace('uhc', 'ᴜʜᴄ').replace('pot', 'ᴘᴏᴛ').replace('nethpot', 'ɴᴇᴛʜᴘᴏᴛ')
    .replace('smp', 'sᴍᴘ').replace('crystal', 'ᴄʀʏsᴛᴀʟ').replace('bedrock', 'ʙᴇᴅʀᴏᴄᴋ').replace('combo', 'ᴄᴏᴍʙᴏ');
}

/** Discord role name for a mode + tier pair. */
export function roleName(mode, tier) {
  return `${aestheticMode(mode)} • ${aestheticTier(tier)}`;
}

export function testerRoleName(mode) {
  return `${aestheticMode(mode)} Tester`;
}

/** Rank of a tier inside the ladder (lower == better). */
export function tierRank(tier) {
  const i = TIERS.indexOf(String(tier || '').toUpperCase());
  return i < 0 ? 999 : i;
}

export function isValidMode(mode) {
  return MODES.includes(mode);
}

export function isValidTier(tier) {
  return TIERS.includes(String(tier || '').toUpperCase());
}

export function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Channel layout created by `/setup`. */
export const CHANNEL_PLAN = [
  ['📜・tier-rules', 'rules'],
  ['🧰・tier-kits', 'kits'],
  ['📝・tier-apply', 'apply'],
  ['⏳・tier-queue', 'queue'],
  ['➕・join-queue', 'join'],
  ['🏆・tier-results', 'results'],
  ['🔥・high-tier-result', 'high'],
  ['👑・official-ranking', 'ranking'],
  ['⚠️・punishment', 'punishment'],
  ['📚・tier-content', 'content']
];

export const CATEGORY_NAME = '🧪・TIER TESTING';

/** Slash command catalogue — used by the bot and rendered on the dashboard. */
export const COMMAND_CATALOG = [
  {
    name: 'setup',
    description: 'Create the Minecraft tier-testing roles and channels.',
    permission: 'Manage Server',
    options: []
  },
  {
    name: 'test',
    description: 'Give a player a tier role for a gamemode.',
    permission: 'Everyone',
    options: [
      { name: 'player', type: 'User', required: true },
      { name: 'mode', type: 'Choice', required: true, choices: MODES },
      { name: 'tier', type: 'Choice', required: true, choices: TIERS }
    ]
  },
  {
    name: 'tier',
    description: 'Create a premium tier-result card and assign the tier role.',
    permission: 'Everyone',
    options: [
      { name: 'player', type: 'User', required: true },
      { name: 'gamertag', type: 'String', required: true },
      { name: 'rank', type: 'Choice', required: true, choices: TIERS },
      { name: 'gm', type: 'Choice', required: true, choices: MODES },
      { name: 'note', type: 'String', required: false },
      { name: 'region', type: 'String', required: false },
      { name: 'device', type: 'String', required: false }
    ]
  },
  {
    name: 'profile',
    description: "Show a player's full tier profile.",
    permission: 'Everyone',
    options: [{ name: 'member', type: 'User', required: true }]
  },
  {
    name: 'leaderboard',
    description: 'Show the server tier leaderboard.',
    permission: 'Everyone',
    options: [{ name: 'mode', type: 'Choice', required: false, choices: MODES }]
  },
  {
    name: 'modes',
    description: 'List all configured Minecraft testing modes.',
    permission: 'Everyone',
    options: []
  }
];
