/**
 * Seeds the local file store with demo data so the dashboard can be previewed
 * without a live Discord bot.
 *
 *   node scripts/seed-demo.js
 *
 * It only writes to the local DATA_DIR (default ./data) — never to a remote
 * Postgres database. Delete ./data afterwards to remove the demo data.
 */
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';

const DATA = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), 'data');

const MODES = ['Sword', 'Axe', 'Mace', 'UHC', 'Pot', 'NethPot', 'SMP', 'Crystal', 'Bedrock', 'Combo'];
const TIERS = ['HT1', 'LT1', 'HT2', 'LT2', 'HT3', 'LT3', 'HT4', 'LT4', 'HT5', 'LT5'];

const NAMES = [
  ['Steve', 'steve_yt', 'HT1'], ['Alex', 'alex_mc', 'LT1'], ['Notch', 'notch', 'HT2'],
  ['Herobrine', 'herobrine_', 'LT2'], ['Creeper', 'creeper99', 'HT3'], ['Ender', 'ender_x', 'LT3'],
  ['Piglin', 'piglin_nm', 'HT4'], ['Drip', 'drippy_', 'LT4'], ['Blaze', 'blaze_qq', 'HT5'],
  ['Warden', 'warden_go', 'LT5'], ['Alex2', 'alex_two', 'HT1'], ['Zed', 'zed_mc', 'HT2']
];

const now = Date.now();
const roles = {};
for (const mode of MODES) {
  roles[mode] = {};
  TIERS.forEach((tier, index) => {
    roles[mode][tier] = `role-${mode.toLowerCase()}-${tier.toLowerCase()}-${index}`;
  });
}

const results = {};
NAMES.forEach(([name, tag, tier], index) => {
  const userId = `1000000000000000${String(index).padStart(3, '0')}`;
  const modes = MODES.slice(0, 3 + (index % 6));
  results[userId] = {};
  modes.forEach((mode, modeIndex) => {
    results[userId][mode] = {
      tier: TIERS[(index + modeIndex) % TIERS.length],
      gamertag: tag,
      note: modeIndex === 0 ? 'clean hits' : 'ggs',
      region: index % 3 === 0 ? 'AS' : index % 3 === 1 ? 'EU' : 'NA',
      device: modeIndex % 2 === 0 ? 'Mobile' : 'PC',
      tester: '1000000000000000900',
      updatedAt: new Date(now - index * 3_600_000 - modeIndex * 600_000).toISOString()
    };
  });
});

const guild = {
  id: '112233445566778899',
  name: 'Aether PvP',
  memberCount: 4821,
  icon: null,
  roles,
  testerRoles: Object.fromEntries(MODES.map(m => [m, `tester-${m.toLowerCase()}`])),
  channels: {
    rules: 'c1', kits: 'c2', apply: 'c3', queue: 'c4', join: 'c5',
    results: 'c6', high: 'c7', ranking: 'c8', punishment: 'c9', content: 'c10'
  },
  resultsChannel: 'c6',
  highResultsChannel: 'c7',
  results,
  queue: ['1000000000000000000', '1000000000000000001', '1000000000000000002'],
  applications: [
    { id: 'demo-1', userId: '1000000000000000005', gamertag: 'pixel_pete', mode: 'Sword', note: 'Looking for crystal too', status: 'pending', createdAt: new Date(now - 5_400_000).toISOString() },
    { id: 'demo-2', userId: '1000000000000000006', gamertag: 'redstone_ron', mode: 'Crystal', note: 'Neth pot ready', status: 'pending', createdAt: new Date(now - 9_000_000).toISOString() },
    { id: 'demo-3', userId: '1000000000000000007', gamertag: 'blazer_99', mode: 'Axe', note: 'First test', status: 'approved', createdAt: new Date(now - 86_400_000).toISOString(), handledAt: new Date(now - 82_000_000).toISOString() }
  ],
  updatedAt: new Date(now - 60_000).toISOString()
};

const secondGuild = {
  id: '998877665544332211',
  name: 'Nether Testing Grounds',
  memberCount: 1204,
  icon: null,
  roles: { Sword: roles.Sword, Axe: roles.Axe },
  testerRoles: { Sword: 'tester-sword' },
  channels: { results: 'd6', high: 'd7', apply: 'd3' },
  resultsChannel: 'd6',
  highResultsChannel: 'd7',
  results: {
    '1000000000000000100': {
      Sword: { tier: 'HT3', gamertag: 'nether_nate', note: 'solid', region: 'EU', device: 'PC', tester: '1000000000000000900', updatedAt: new Date(now - 7_200_000).toISOString() }
    }
  },
  queue: [],
  applications: [],
  updatedAt: new Date(now - 7_200_000).toISOString()
};

await fs.mkdir(DATA, { recursive: true });
await fs.writeFile(path.join(DATA, 'guild%3A112233445566778899.json'), JSON.stringify(guild, null, 2));
await fs.writeFile(path.join(DATA, 'guild%3A998877665544332211.json'), JSON.stringify(secondGuild, null, 2));
await fs.writeFile(path.join(DATA, 'guilds%3Aindex.json'), JSON.stringify([
  { id: guild.id, at: guild.updatedAt },
  { id: secondGuild.id, at: secondGuild.updatedAt }
], null, 2));

const botState = {
  status: 'online',
  version: '6.2.0',
  sessionId: 'demo-session-0001',
  startedAt: new Date(now - 5_400_000).toISOString(),
  updatedAt: new Date().toISOString(),
  heartbeatAt: Date.now(),
  user: { id: '1000000000000000000', tag: 'TierTestBot#0001', username: 'TierTestBot', avatar: null },
  guilds: [
    { id: guild.id, name: guild.name, memberCount: guild.memberCount, icon: null },
    { id: secondGuild.id, name: secondGuild.name, memberCount: secondGuild.memberCount, icon: null }
  ],
  guildCount: 2,
  latency: 42,
  memory: 96
};
await fs.writeFile(path.join(DATA, 'system%3Abot.json'), JSON.stringify(botState, null, 2));

const logs = [
  ['info', 'bot', 'Logged in as TierTestBot#0001 (2 guilds)'],
  ['info', 'bot', 'Slash commands registered.'],
  ['info', 'command', '/tier 1000000000000000001 → HT1 (Sword)'],
  ['info', 'command', '/test 1000000000000000002 → LT2 (Axe)'],
  ['warn', 'gateway', 'Disconnected (code 1006) — reconnecting…'],
  ['info', 'gateway', 'Session resumed'],
  ['info', 'action', 'assignTier → ok'],
  ['error', 'action', 'approveApplication failed: Application not found']
].map(([level, scope, message], index) => ({
  id: `demo-log-${index}`,
  ts: new Date(now - index * 120_000).toISOString(),
  level,
  scope,
  message
}));
await fs.writeFile(path.join(DATA, 'system%3Alogs.json'), JSON.stringify(logs, null, 2));

console.log(`Seeded demo data into ${DATA}`);
console.log('Run `npm run dev` and open http://localhost:3000 to explore the dashboard.');
console.log('Remove the demo data with: rm -rf data');
