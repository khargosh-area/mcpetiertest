import 'dotenv/config';
import {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder,
  PermissionFlagsBits, ChannelType, EmbedBuilder, AttachmentBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, PermissionsBitField
} from 'discord.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent] });
const DATA = path.join(process.cwd(), 'data');
const DB = path.join(DATA, 'guilds.json');

/*
  Add/remove modes here. Each mode gets HT1, LT1 ... HT5, LT5 roles.
  These are common Minecraft PvP testing modes; the setup command is safe
  to run again because it reuses existing roles/channels when possible.
*/
const MODES = [
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

const TIERS = ['HT1','LT1','HT2','LT2','HT3','LT3','HT4','LT4','HT5','LT5'];

const MODE_ICONS = {
  Sword: '⚔️', Axe: '🪓', Mace: '🔨', UHC: '❤️', Pot: '🧪',
  NethPot: '💥', SMP: '🛡️', Crystal: '💎', Bedrock: '🪨', Combo: '⚡'
};

function aestheticTier(tier) {
  const map = { '1':'¹','2':'²','3':'³','4':'⁴','5':'⁵' };
  const m = String(tier || '').match(/^(HT|LT)([1-5])$/i);
  return m ? `ʜ${m[1][1].toLowerCase()}${map[m[2]]}` : String(tier || '');
}

function tierAccent(tier) {
  const colors = { HT1:'#ff4d67', LT1:'#ff6b81', HT2:'#ff9f43', LT2:'#ffb35c', HT3:'#ffd166', LT3:'#ffe08a', HT4:'#56d6ff', LT4:'#7de0ff', HT5:'#a78bfa', LT5:'#c4b5fd' };
  return colors[tier] || '#7c3aed';
}

function escapeXml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&apos;');
}

function aestheticMode(mode) {
  return mode.toLowerCase().replace(/^[a-z]/, c => c.toLowerCase())
    .replace('sword','sᴡᴏʀᴅ').replace('axe','ᴀxᴇ').replace('mace','ᴍᴀᴄᴇ')
    .replace('uhc','ᴜʜᴄ').replace('pot','ᴘᴏᴛ').replace('nethpot','ɴᴇᴛʜᴘᴏᴛ')
    .replace('smp','sᴍᴘ').replace('crystal','ᴄʀʏsᴛᴀʟ').replace('bedrock','ʙᴇᴅʀᴏᴄᴋ').replace('combo','ᴄᴏᴍʙᴏ');
}

function roleName(mode, tier) { return `${aestheticMode(mode)} • ${aestheticTier(tier)}`; }

// Optional Discord Application Emojis. Create these exact names in your app/server;
// the bot uses them automatically and falls back to Unicode if one is missing.
const APP_EMOJIS = {
  sword: 'tt_sword', axe: 'tt_axe', mace: 'tt_mace', uhc: 'tt_heart',
  pot: 'tt_pot', nethpot: 'tt_fire', smp: 'tt_shield', crystal: 'tt_crystal',
  bedrock: 'tt_bedrock', combo: 'tt_combo', tier: 'tt_tier', tester: 'tt_tester',
  player: 'tt_player', note: 'tt_note', stats: 'tt_stats',
  previous: 'tt_previous', gamertag: 'tt_gamertag', region: 'tt_region', device: 'tt_device',
  apply: 'tt_apply', queue: 'tt_queue', join: 'tt_join', leave: 'tt_leave', ticket: 'tt_ticket',
  claim: 'tt_claim', close: 'tt_close', position: 'tt_position', accept: 'tt_accept', deny: 'tt_deny',
  rules: 'tt_rules', kits: 'tt_kits', results: 'tt_results', high: 'tt_high', ranking: 'tt_ranking',
  punishment: 'tt_punishment', content: 'tt_content'
};

function appEmoji(key, fallback) {
  const name = APP_EMOJIS[key];
  if (!name || !client.application?.emojis?.cache) return fallback;
  const emoji = client.application.emojis.cache.find(e => e.name === name);
  return emoji ? emoji.toString() : fallback;
}

function modeEmoji(mode) {
  const keys = { Sword:'sword', Axe:'axe', Mace:'mace', UHC:'uhc', Pot:'pot', NethPot:'nethpot', SMP:'smp', Crystal:'crystal', Bedrock:'bedrock', Combo:'combo' };
  return appEmoji(keys[mode], MODE_ICONS[mode] || '🎮');
}


async function readDB() {
  try { return JSON.parse(await fs.readFile(DB, 'utf8')); }
  catch { return {}; }
}
async function writeDB(db) {
  await fs.mkdir(DATA, { recursive: true });
  await fs.writeFile(DB, JSON.stringify(db, null, 2));
}

const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Create the complete public tier-testing system.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('test')
    .setDescription('Run a test assignment and update the player tier.')
    .addUserOption(o => o.setName('player').setDescription('Player being tested').setRequired(true))
    .addStringOption(o => o.setName('mode').setDescription('Minecraft gamemode').setRequired(true)
      .addChoices(...MODES.map(m => ({ name: m, value: m }))))
    .addStringOption(o => o.setName('tier').setDescription('Tier awarded').setRequired(true)
      .addChoices(...TIERS.map(t => ({ name: t, value: t }))))
    .addUserOption(o => o.setName('tester').setDescription('Tester who conducted the test').setRequired(true)),
  new SlashCommandBuilder()
    .setName('tier')
    .setDescription('Post the official premium tier card and assign the tier role.')
    .addUserOption(o => o.setName('player').setDescription('Discord player').setRequired(true))
    .addStringOption(o => o.setName('gamertag').setDescription('Minecraft gamertag').setRequired(true))
    .addStringOption(o => o.setName('rank').setDescription('Tier rank').setRequired(true)
      .addChoices(...TIERS.map(t => ({ name: t, value: t }))))
    .addStringOption(o => o.setName('gm').setDescription('Gamemode').setRequired(true)
      .addChoices(...MODES.map(m => ({ name: m, value: m }))))
    .addUserOption(o => o.setName('tester').setDescription('Tester who conducted the test').setRequired(true))
    .addStringOption(o => o.setName('note').setDescription('Test note').setRequired(false))
    .addStringOption(o => o.setName('region').setDescription('Region, e.g. AS').setRequired(false))
    .addStringOption(o => o.setName('device').setDescription('Device, e.g. Mobile').setRequired(false)),
  new SlashCommandBuilder()
    .setName('profile')
    .setDescription("Show a player's complete tier profile.")
    .addUserOption(o => o.setName('member').setDescription('Discord member').setRequired(true)),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the server tier leaderboard.')
    .addStringOption(o => o.setName('mode').setDescription('Gamemode').setRequired(false)
      .addChoices(...MODES.map(m => ({ name: m, value: m })))),
  new SlashCommandBuilder()
    .setName('modes')
    .setDescription('List all configured Minecraft testing modes.'),
  new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register your Minecraft gamertag and get the Registered role.')
    .addStringOption(o => o.setName('gamertag').setDescription('Your Minecraft gamertag').setRequired(true).setMaxLength(32))
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
}

async function getOrCreateRole(guild, name) {
  let role = guild.roles.cache.find(r => r.name === name);
  if (!role) {
    role = await guild.roles.create({
      name,
      reason: 'TierTestBot automatic tier setup'
    });
  }
  return role;
}

async function setupGuild(guild) {
  const db = await readDB();
  db[guild.id] ??= { roles: {}, results: {} };

  for (const mode of MODES) {
    db[guild.id].roles[mode] ??= {};
    for (const tier of TIERS) {
      const desiredName = roleName(mode, tier);
      let role = guild.roles.cache.find(r => r.name === desiredName);
      if (!role) {
        // Reuse and rename an older TierTestBot role if it exists.
        role = guild.roles.cache.find(r => r.name === `${mode} • ${tier}`);
      }
      if (!role) role = await getOrCreateRole(guild, desiredName);
      else if (role.name !== desiredName) role = await role.setName(desiredName, 'TierTestBot aesthetic role update');
      db[guild.id].roles[mode][tier] = role.id;
    }
    const testerName = `${aestheticMode(mode)} Tester`;
    let testerRole = guild.roles.cache.find(r => r.name === testerName);
    if (!testerRole) testerRole = await getOrCreateRole(guild, testerName);
    db[guild.id].testerRoles ??= {};
    db[guild.id].testerRoles[mode] = testerRole.id;
  }

  const categoryName = '🧪・TIER TESTING';
  let category = guild.channels.cache.find(
    c => c.type === ChannelType.GuildCategory && (c.name === categoryName || c.name === '⚔️ TIER TESTING')
  );
  if (category && category.name !== categoryName) {
    try { await category.setName(categoryName, 'TierTestBot aesthetic setup update'); } catch {}
  }
  if (!category) {
    category = await guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory,
      reason: 'TierTestBot automatic setup'
    });
  }

  const channelPlan = [
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

  db[guild.id].channels ??= {};
  for (const [channelName, key] of channelPlan) {
    let ch = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === channelName);
    if (!ch) {
      ch = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.id,
        reason: 'TierTestBot automatic tier system setup'
      });
    }
    db[guild.id].channels[key] = ch.id;
  }

  const resultsChannel = guild.channels.cache.get(db[guild.id].channels.results);
  const highResultsChannel = guild.channels.cache.get(db[guild.id].channels.high);
  db[guild.id].resultsChannel = resultsChannel?.id;
  db[guild.id].highResultsChannel = highResultsChannel?.id;
  db[guild.id].categoryId = category.id;
  await writeDB(db);
  await postPanels(guild, db[guild.id]);
  return db[guild.id];
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try { await registerCommands(); console.log('Slash commands registered.'); }
  catch (e) { console.error('Command registration failed:', e.message); }
});

client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.toLowerCase().startsWith('-help')) return;
  const embed = new EmbedBuilder()
    .setTitle('⚔️ ᴛɪᴇʀᴛᴇsᴛʙᴏᴛ • ʜᴇʟᴘ')
    .setDescription('**Minecraft PvP Tier Testing**')
    .addFields(
      { name: '🎮 ᴄᴏᴍᴍᴀɴᴅs', value: '`/setup` • Setup roles/channels\n`/test` • Assign a tier (choose tester)\n`/tier` • Official result + premium card (choose tester)\n`/profile member:@player` • View profile\n`/leaderboard` • View rankings\n`/modes` • View gamemodes' },
      { name: '🧪 ᴛᴇsᴛᴇʀ ʀᴏʟᴇs', value: MODES.map(m => `${MODE_ICONS[m]} ${aestheticMode(m)} Tester`).join(' • ') }
    )
    .setFooter({ text: 'TierTestBot • Type -help anytime' });
  await message.reply({ embeds: [embed] });
});



async function getPreviousTier(cfg, member, mode) {
  // Prefer saved history, but fall back to the player's currently assigned role.
  const saved = cfg.results?.[member.id]?.[mode]?.tier;
  if (saved && TIERS.includes(saved)) return saved;
  for (const tier of TIERS) {
    const roleId = cfg.roles?.[mode]?.[tier];
    if (roleId && member.roles.cache.has(roleId)) return tier;
  }
  return null;
}

function panelEmbed(type) {
  const base = new EmbedBuilder().setTimestamp().setFooter({ text: 'TierTestBot • Official Minecraft PvP Testing' });
  if (type === 'apply') return base.setColor('#7c3aed').setAuthor({name:'📝 ᴛɪᴇʀᴛᴇsᴛ • ᴀᴘᴘʟɪᴄᴀᴛɪᴏɴ'}).setTitle('✦ ᴛɪᴇʀ ᴛᴇsᴛ ᴀᴘᴘʟʏ').setDescription('Ready to get tested?\n\nClick **Apply Now** and submit your Minecraft gamertag, preferred mode and a short note.\n\n> ✦ Keep your details accurate. A tester will review your application.');
  if (type === 'queue') return base.setColor('#f59e0b').setAuthor({name:'⏳ ᴛɪᴇʀᴛᴇsᴛ • ǫᴜᴇᴜᴇ'}).setTitle('✦ ᴛᴇsᴛɪɴɢ ǫᴜᴇᴜᴇ').setDescription('Join the testing queue and wait for an available tester.\n\nUse the buttons below to **join** or **leave** the queue.');
  if (type === 'results') return base.setColor('#22c55e').setAuthor({name:'🏆 ᴛɪᴇʀᴛᴇsᴛ • ʀᴇsᴜʟᴛs'}).setTitle('✦ ᴏғғɪᴄɪᴀʟ ᴛɪᴇʀ ʀᴇsᴜʟᴛs').setDescription('Official tier cards and verified results are posted here automatically by **/tier**.');
  if (type === 'high') return base.setColor('#ef4444').setAuthor({name:'🔥 ᴛɪᴇʀᴛᴇsᴛ • ʜɪɢʜ ᴛɪᴇʀ'}).setTitle('✦ ʜɪɢʜ ᴛɪᴇʀ ʀᴇsᴜʟᴛs').setDescription('Top-tier results are highlighted here automatically.\n\n**HT1 • LT1 • HT2 • LT2**');
  if (type === 'ranking') return base.setColor('#8b5cf6').setAuthor({name:'👑 ᴛɪᴇʀᴛᴇsᴛ • ʀᴀɴᴋɪɴɢ'}).setTitle('✦ ᴏғғɪᴄɪᴀʟ ʀᴀɴᴋɪɴɢ').setDescription('Use **View Leaderboard** to see the current server rankings.');
  if (type === 'rules') return base.setColor('#5865f2').setTitle('📜・ᴛɪᴇʀ ʀᴜʟᴇs').setDescription('• Play fair and follow server rules.\n• No cheating, exploits or intentional abuse.\n• Respect testers and other players.\n• Results must be based on the configured testing system.');
  if (type === 'kits') return base.setColor('#14b8a6').setTitle('🧰・ᴛɪᴇʀ ᴋɪᴛs').setDescription('Testing kits and mode-specific preparation information will be listed here.');
  if (type === 'punishment') return base.setColor('#ef4444').setTitle('⚠️・ᴘᴜɴɪsʜᴍᴇɴᴛ').setDescription('Use this channel for documented moderation actions and official punishment information.');
  return base.setColor('#6366f1').setTitle('📚・ᴛɪᴇʀ ᴄᴏɴᴛᴇɴᴛ').setDescription('Official tier-testing guides, clips and educational content.');
}

function panelRows(type) {
  if (type === 'apply') return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tt_apply').setLabel('Apply Now').setEmoji(appEmoji('apply','📝')).setStyle(ButtonStyle.Primary))];
  if (type === 'queue') return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tt_queue_join').setLabel('Choose Gamemode').setEmoji(appEmoji('join','➕')).setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('tt_queue_leave').setLabel('Leave Queue').setEmoji(appEmoji('leave','➖')).setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('tt_queue_view').setLabel('View Queue').setEmoji('👀').setStyle(ButtonStyle.Primary))];
  if (type === 'ranking') return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tt_leaderboard').setLabel('View Leaderboard').setEmoji(appEmoji('ranking','👑')).setStyle(ButtonStyle.Primary))];
  if (type === 'results') return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tt_modes').setLabel('Testing Modes').setEmoji('🎮').setStyle(ButtonStyle.Secondary))];
  return [];
}

async function sendPanel(channel, type) {
  const embed = panelEmbed(type); const rows = panelRows(type);
  if (rows.length) return channel.send({embeds:[embed], components:rows});
  return channel.send({embeds:[embed]});
}

async function postPanels(guild, cfg) {
  const mapping = {rules:'rules', kits:'kits', apply:'apply', queue:'queue', results:'results', high:'high', ranking:'ranking', punishment:'punishment', content:'content'};
  for (const [type,key] of Object.entries(mapping)) {
    const id=cfg.channels?.[key]; const ch=id?guild.channels.cache.get(id):null; if(!ch) continue;
    const recent=await ch.messages.fetch({limit:10}).catch(()=>null);
    const marker='TierTestBot • Official Minecraft PvP Testing';
    const has=recent?.some(m=>m.author.id===client.user.id && m.embeds?.some(e=>e.footer?.text===marker));
    if(!has) await sendPanel(ch,type).catch(console.error);
  }
}

async function fetchBase64(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer()).toString('base64');
  } catch {
    return null;
  }
}

async function buildTierCard({ guildName, player, gamertag, mode, tier, tester, previousTier, note, region = 'AS', device = 'Mobile' }) {
  const accent = tierAccent(tier);
  // Keep the Minecraft skin on the card; do not substitute the Discord avatar.
  const skinData = await fetchBase64(`https://mc-heads.net/body/${encodeURIComponent(gamertag)}/right`);
  const avatar = skinData
    ? `<rect x="62" y="142" width="236" height="316" rx="24" fill="#ffffff" fill-opacity="0.025" stroke="${accent}" stroke-opacity="0.5"/><image href="data:image/png;base64,${skinData}" x="78" y="150" width="204" height="292" preserveAspectRatio="xMidYMid meet"/><rect x="62" y="142" width="236" height="316" rx="24" fill="none" stroke="${accent}" stroke-opacity="0.5" stroke-width="2"/>`
    : `<rect x="62" y="142" width="236" height="316" rx="24" fill="#171b2b" stroke="${accent}" stroke-width="2"/><text x="180" y="292" text-anchor="middle" fill="#8e97ad" font-size="20" font-family="DejaVu Sans, sans-serif">SKIN</text><text x="180" y="322" text-anchor="middle" fill="#8e97ad" font-size="14" font-family="DejaVu Sans, sans-serif">UNAVAILABLE</text>`;

  const guildText = String(guildName || 'TIER TESTING').slice(0, 28);
  const safeTester = tester?.username || 'Unknown Tester';
  const safeNote = String(note || 'ggs').slice(0, 80);
  const prev = previousTier ? String(previousTier) : 'NOT TESTED';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#080b16"/><stop offset="55%" stop-color="#11162a"/><stop offset="100%" stop-color="#17102a"/></linearGradient>
      <linearGradient id="glowLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${accent}" stop-opacity="0"/><stop offset="50%" stop-color="${accent}"/><stop offset="100%" stop-color="${accent}" stop-opacity="0"/></linearGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="28"/></filter>
      <filter id="soft"><feGaussianBlur stdDeviation="8"/></filter>
    </defs>
    <rect width="1200" height="630" rx="34" fill="url(#bg)"/>
    <circle cx="1040" cy="90" r="190" fill="${accent}" opacity="0.09" filter="url(#blur)"/>
    <circle cx="140" cy="530" r="180" fill="${accent}" opacity="0.07" filter="url(#blur)"/>
    <rect x="24" y="24" width="1152" height="582" rx="28" fill="none" stroke="${accent}" stroke-opacity="0.5" stroke-width="2"/>
    <rect x="48" y="70" width="1104" height="3" rx="2" fill="url(#glowLine)"/>

    <text x="72" y="55" fill="#f5f7ff" font-size="23" font-weight="700" font-family="DejaVu Sans, sans-serif">${escapeXml(guildText)}</text>
    <text x="72" y="92" fill="#7f8aa5" font-size="13" letter-spacing="4" font-family="DejaVu Sans, sans-serif">OFFICIAL TIER TESTING SYSTEM</text>
    <text x="1128" y="55" text-anchor="end" fill="#aab3c7" font-size="15" font-family="DejaVu Sans, sans-serif">TIER RESULT</text>
    <text x="1128" y="80" text-anchor="end" fill="${accent}" font-size="15" font-weight="700" font-family="DejaVu Sans, sans-serif">OFFICIAL</text>

    ${avatar}
    <text x="180" y="486" text-anchor="middle" fill="#ffffff" font-size="20" font-weight="700" font-family="DejaVu Sans, sans-serif">MINECRAFT SKIN</text>
    <text x="180" y="510" text-anchor="middle" fill="#8490aa" font-size="14" font-family="DejaVu Sans, sans-serif">${escapeXml(String(gamertag || 'Unknown').slice(0, 20))}</text>

    <text x="340" y="155" fill="#8d98b0" font-size="16" letter-spacing="4" font-family="DejaVu Sans, sans-serif">${escapeXml(mode.toUpperCase())} • TIER AWARDED</text>
    <text x="340" y="195" fill="#8d98b0" font-size="14" letter-spacing="2" font-family="DejaVu Sans, sans-serif">MINECRAFT GAMERTAG</text>
    <text x="340" y="235" fill="#ffffff" font-size="36" font-weight="700" font-family="DejaVu Sans, sans-serif">${escapeXml(String(gamertag || 'Unknown').slice(0, 20))}</text>
    <text x="340" y="355" fill="${accent}" font-size="112" font-weight="900" font-family="DejaVu Sans, sans-serif">${escapeXml(tier)}</text>
    <text x="345" y="390" fill="#aab3c7" font-size="16" letter-spacing="5" font-family="DejaVu Sans, sans-serif">${tier.startsWith('HT') ? 'HIGH TIER' : 'LOW TIER'} ${tier.slice(-1)}</text>

    <rect x="340" y="418" width="330" height="76" rx="18" fill="#ffffff" fill-opacity="0.035" stroke="${accent}" stroke-opacity="0.28"/>
    <text x="365" y="447" fill="#8d98b0" font-size="12" letter-spacing="2" font-family="DejaVu Sans, sans-serif">PREVIOUS TIER</text>
    <text x="365" y="478" fill="${previousTier ? accent : '#b5bfd1'}" font-size="23" font-weight="700" font-family="DejaVu Sans, sans-serif">${escapeXml(previousTier || 'NOT TESTED')}</text>

    <rect x="690" y="125" width="430" height="78" rx="18" fill="#ffffff" fill-opacity="0.035" stroke="#ffffff" stroke-opacity="0.08"/>
    <text x="716" y="153" fill="#7f8aa5" font-size="12" letter-spacing="2" font-family="DejaVu Sans, sans-serif">TESTER</text>
    <text x="716" y="183" fill="#ffffff" font-size="22" font-weight="700" font-family="DejaVu Sans, sans-serif">${escapeXml(safeTester)}</text>

    <rect x="690" y="218" width="430" height="78" rx="18" fill="#ffffff" fill-opacity="0.035" stroke="#ffffff" stroke-opacity="0.08"/>
    <text x="716" y="246" fill="#7f8aa5" font-size="12" letter-spacing="2" font-family="DejaVu Sans, sans-serif">REGION • DEVICE</text>
    <text x="716" y="276" fill="#ffffff" font-size="20" font-weight="700" font-family="DejaVu Sans, sans-serif">${escapeXml(region.toUpperCase())} • ${escapeXml(device)}</text>

    <rect x="690" y="311" width="430" height="183" rx="18" fill="#ffffff" fill-opacity="0.035" stroke="#ffffff" stroke-opacity="0.08"/>
    <text x="716" y="341" fill="#7f8aa5" font-size="12" letter-spacing="2" font-family="DejaVu Sans, sans-serif">NOTE</text>
    <text x="716" y="377" fill="#ffffff" font-size="19" font-family="DejaVu Sans, sans-serif">${escapeXml(safeNote)}</text>
    <text x="716" y="440" fill="#75e7a2" font-size="20" font-weight="700" font-family="DejaVu Sans, sans-serif">✓ TEST PASSED</text>
    <text x="716" y="470" fill="#8490aa" font-size="13" font-family="DejaVu Sans, sans-serif">Performance-based official tier assignment</text>

    <rect x="48" y="535" width="1104" height="2" fill="url(#glowLine)"/>
    <text x="72" y="574" fill="#8d98b0" font-size="13" letter-spacing="2" font-family="DejaVu Sans, sans-serif">PLAY • TEST • IMPROVE • RANK UP</text>
    <text x="1128" y="574" text-anchor="end" fill="#ffffff" font-size="14" font-family="DejaVu Sans, sans-serif">Made by Khargosh with ❤️</text>
  </svg>`;

  return sharp(Buffer.from(svg)).png({ quality: 95 }).toBuffer();
}


async function createQueueTicket(interaction, mode) {
  const db = await readDB();
  const cfg = db[interaction.guild.id];
  if (!cfg) return null;
  if (Array.isArray(cfg.queue)) cfg.queue = {};
  cfg.queue ??= {};
  cfg.queue[mode] ??= [];
  if (!cfg.queue[mode].includes(interaction.user.id)) cfg.queue[mode].push(interaction.user.id);
  await writeDB(db);

  const existing = interaction.guild.channels.cache.find(c => c.topic === `TierTestBot ticket:${interaction.user.id}:${mode}`);
  if (existing) return { channel: existing, position: cfg.queue[mode].indexOf(interaction.user.id) + 1 };

  const safe = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'player';
  const channel = await interaction.guild.channels.create({
    name: `🎫・${safe}-${mode.toLowerCase()}`.slice(0, 100),
    type: ChannelType.GuildText,
    parent: cfg.categoryId || undefined,
    topic: `TierTestBot ticket:${interaction.user.id}:${mode}`,
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
      { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ReadMessageHistory] }
    ]
  });

  const position = cfg.queue[mode].indexOf(interaction.user.id) + 1;
  const embed = new EmbedBuilder()
    .setColor('#8b5cf6')
    .setTitle(`${appEmoji('ticket','🎫')}・ᴛɪᴇʀ ᴛᴇsᴛ ᴛɪᴄᴋᴇᴛ`)
    .setDescription(`Welcome ${interaction.user}!\n\n**Gamemode:** ${modeEmoji(mode)} ${aestheticMode(mode)}\n**Queue Position:** #${position}\n\nA tester can claim this ticket when ready.`)
    .setFooter({ text: `${interaction.guild.name} • Tier Testing` });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tt_ticket_claim:${mode}`).setLabel('Claim Test').setEmoji(appEmoji('claim','🧪')).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`tt_ticket_close:${mode}`).setLabel('Close Ticket').setEmoji(appEmoji('close','🔒')).setStyle(ButtonStyle.Danger)
  );
  await channel.send({ embeds: [embed], components: [row] });
  return { channel, position };
}

client.on('interactionCreate', async interaction => {
  if (!interaction.guild) return;

  try {
    if (interaction.commandName === 'setup') {
      await interaction.deferReply({ ephemeral: true });
      const cfg = await setupGuild(interaction.guild);

      await interaction.editReply(
        `✅ **Tier testing setup complete!**\n\n` +
        `Created/verified **${MODES.length * TIERS.length} tier roles** across ${MODES.length} gamemodes.\n` +
        `Example: **ᴀxᴇ • ʟᴛ³**\n` +
        `Created tester roles such as **ᴀxᴇ Tester**.\n\n` +
        `📋 Results channel: <#${cfg.resultsChannel}>\n` +
        `🗂️ Created the full tier-testing channel layout.\n` +
        `Use **/test** for testing or **/tier** for the official premium image card. Both commands let you select the tester.`
      );
      return;
    }

    if (interaction.commandName === 'register') {
      const gamertag = interaction.options.getString('gamertag', true).trim();
      if (!/^[A-Za-z0-9_ ]{1,32}$/.test(gamertag)) {
        return interaction.reply({ content: '❌ Use a valid Minecraft gamertag (letters, numbers, underscores, spaces; max 32 characters).', ephemeral: true });
      }
      const member = await interaction.guild.members.fetch(interaction.user.id);
      await member.setNickname(gamertag, 'Minecraft gamertag registration').catch(err => { throw new Error(`Could not set server nickname: ${err.message}`); });
      let registeredRole = interaction.guild.roles.cache.find(r => r.name === 'Registered');
      if (!registeredRole) registeredRole = await interaction.guild.roles.create({ name: 'Registered', reason: 'TierTestBot registration role' });
      await member.roles.add(registeredRole, 'Minecraft gamertag registration');
      const dbReg = await readDB();
      dbReg[interaction.guild.id] ??= { roles: {}, results: {} };
      dbReg[interaction.guild.id].registrations ??= {};
      dbReg[interaction.guild.id].registrations[interaction.user.id] = { gamertag, registeredAt: new Date().toISOString() };
      await writeDB(dbReg);
      return interaction.reply({ content: `✅ Registered as **${gamertag}**. Your server nickname and **Registered** role have been updated.`, ephemeral: true });
    }

    if (interaction.commandName === 'modes') {
      await interaction.reply({
        content: `🎮 **Minecraft Testing Modes**\n${MODES.map(m => `• ${m}`).join('\n')}`,
        ephemeral: true
      });
      return;
    }

    const db = await readDB();
    const cfg = db[interaction.guild.id];
    if (!cfg) {
      await interaction.reply({ content: '⚠️ Run **/setup** first.', ephemeral: true });
      return;
    }

    if (interaction.commandName === 'test') {
      const player = interaction.options.getUser('player');
      const mode = interaction.options.getString('mode');
      const tier = interaction.options.getString('tier');
      const tester = interaction.options.getUser('tester');

      const member = await interaction.guild.members.fetch(player.id);
      const roleId = cfg.roles?.[mode]?.[tier];
      const role = roleId ? interaction.guild.roles.cache.get(roleId) : null;
      if (!role) {
        await interaction.reply({ content: '❌ That tier role is missing. Run /setup again.', ephemeral: true });
        return;
      }

      // Capture the previous tier BEFORE removing the old role.
      const previousTier = await getPreviousTier(cfg, member, mode);

      // Remove every tier role for this mode, then apply the new one.
      for (const oldTier of TIERS) {
        const oldId = cfg.roles?.[mode]?.[oldTier];
        if (oldId && member.roles.cache.has(oldId)) {
          await member.roles.remove(oldId, 'TierTestBot tier update');
        }
      }
      await member.roles.add(role, 'TierTestBot tier result');

      cfg.results ??= {};
      cfg.results[player.id] ??= {};
      cfg.results[player.id][mode] = {
        ...(cfg.results[player.id][mode] || {}),
        tier,
        tester: tester.id,
        updatedAt: new Date().toISOString()
      };
      await writeDB(db);

      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setAuthor({ name: `${appEmoji('tier','⚔️')} TierTestBot • Tier Result`, iconURL: client.user.displayAvatarURL() })
        .setTitle(`${modeEmoji(mode)} ${aestheticMode(mode)} • ${aestheticTier(tier)}`)
        .setThumbnail(player.displayAvatarURL({ size: 256 }))
        .setDescription(`${appEmoji('player','👤')} **Player** ${player}`)
        .addFields(
          { name: `${appEmoji('tier','🏆')} Rank Earned`, value: `**${aestheticTier(tier)}**`, inline: true },
          { name: '📈 Previous', value: previousTier ? `**${aestheticTier(previousTier)}**` : '`NOT TESTED`', inline: true },
          { name: `${appEmoji('tester','🧪')} Tested By`, value: `${tester}`, inline: true }
        )
        .setFooter({ text: 'TierTestBot • Minecraft PvP Rankings' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      const channel = cfg.resultsChannel ? interaction.guild.channels.cache.get(cfg.resultsChannel) : null;
      if (channel && channel.id !== interaction.channel.id) await channel.send({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === 'tier') {
      const player = interaction.options.getUser('player');
      const gamertag = interaction.options.getString('gamertag');
      const tier = interaction.options.getString('rank');
      const mode = interaction.options.getString('gm');
      const note = interaction.options.getString('note') || 'ggs';
      const region = interaction.options.getString('region') || 'AS';
      const device = interaction.options.getString('device') || 'Mobile';
      const tester = interaction.options.getUser('tester');

      const member = await interaction.guild.members.fetch(player.id);
      const roleId = cfg.roles?.[mode]?.[tier];
      const role = roleId ? interaction.guild.roles.cache.get(roleId) : null;
      if (!role) {
        await interaction.reply({ content: '❌ That tier role is missing. Run /setup again.', ephemeral: true });
        return;
      }
      const previousTier = await getPreviousTier(cfg, member, mode);
      for (const oldTier of TIERS) {
        const oldId = cfg.roles?.[mode]?.[oldTier];
        if (oldId && member.roles.cache.has(oldId)) await member.roles.remove(oldId, 'TierTestBot tier update');
      }
      await member.roles.add(role, 'TierTestBot tier result');

      cfg.results ??= {};
      cfg.results[player.id] ??= {};
      cfg.results[player.id][mode] = { tier, gamertag, note, region, device, tester: tester.id, updatedAt: new Date().toISOString() };
      await writeDB(db);

      await interaction.deferReply();
      const image = await buildTierCard({ guildName: interaction.guild.name, player, gamertag, mode, tier, tester, previousTier, note, region, device });
      const attachment = new AttachmentBuilder(image, { name: `tier-${player.id}-${mode.toLowerCase()}.png` });
      const embed = new EmbedBuilder()
        .setColor(tierAccent(tier))
        .setAuthor({ name: `${appEmoji('tier','⚔️')} TierTestBot • Tier Update`, iconURL: client.user.displayAvatarURL() })
        .setTitle(`${modeEmoji(mode)} ${aestheticMode(mode)} • ${aestheticTier(tier)}`)
        .setThumbnail(player.displayAvatarURL({ size: 512, extension: 'png' }))
        .setDescription(`${appEmoji('player','👤')} ${player} • \`${gamertag}\``)
        .addFields(
          { name: '🏆 Rank Earned', value: `**${aestheticTier(tier)}**`, inline: true },
          { name: '📈 Previous', value: previousTier ? `**${aestheticTier(previousTier)}**` : '`UNRANKED`', inline: true },
          { name: `${appEmoji('tester','🧪')} Tester`, value: `${tester}`, inline: true },
          { name: '🌍 Region', value: region, inline: true },
          { name: '📱 Device', value: device, inline: true },
          { name: `${appEmoji('note','📝')} Note`, value: note, inline: false }
        )
        .setImage(`attachment://tier-${player.id}-${mode.toLowerCase()}.png`)
        .setFooter({ text: 'TierTestBot • Minecraft PvP Rankings' })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed], files: [attachment] });
      const channel = cfg.resultsChannel ? interaction.guild.channels.cache.get(cfg.resultsChannel) : null;
      if (channel && channel.id !== interaction.channel.id) await channel.send({ embeds: [embed], files: [attachment] });
      if (['HT1','LT1','HT2','LT2'].includes(tier) && cfg.highResultsChannel) {
        const high = interaction.guild.channels.cache.get(cfg.highResultsChannel);
        if (high && high.id !== interaction.channel.id) await high.send({ embeds: [embed], files: [attachment] }).catch(()=>{});
      }
      return;
    }

    if (interaction.commandName === 'profile') {
      const player = interaction.options.getUser('member');
      const results = cfg.results?.[player.id] || {};
      const testedCount = MODES.filter(m => results[m]).length;
      const last = Object.values(results).sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
      const lastDate = last?.updatedAt ? `<t:${Math.floor(new Date(last.updatedAt).getTime()/1000)}:R>` : '`Never`';
      const gamertag = Object.values(results).find(r => r.gamertag)?.gamertag || 'Not set';

      const modeFields = MODES.map(mode => {
        const result = results[mode];
        if (!result) {
          return {
            name: `${modeEmoji(mode)} ${aestheticMode(mode)}`,
            value: '`NOT TESTED`',
            inline: true
          };
        }
        return {
          name: `${modeEmoji(mode)} ${aestheticMode(mode)}`,
          value: `**${aestheticTier(result.tier)}**\n${appEmoji('tester','🧪')} ${result.tester ? `<@${result.tester}>` : '`Unknown`'}`,
          inline: true
        };
      });

      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setAuthor({ name: `${appEmoji('tier','⚔️')} TierTestBot • Player Profile`, iconURL: client.user.displayAvatarURL() })
        .setTitle(`${player.username}'s Tier Profile`)
        .setThumbnail(player.displayAvatarURL({ size: 512, extension: 'png' }))
        .setDescription(`${appEmoji('player','👤')} **Discord:** ${player}\n🎮 **Minecraft:** \`${gamertag}\`\n\n${appEmoji('stats','📊')} **${testedCount}/${MODES.length}** gamemodes tested`)
        .addFields(modeFields)
        .addFields({
          name: '📌 Profile Stats',
          value: `**Tests:** ${testedCount}/${MODES.length}\n**Last Tested:** ${lastDate}`,
          inline: false
        })
        .setFooter({ text: 'TierTestBot • /profile member:@player' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === 'leaderboard') {
      const mode = interaction.options.getString('mode');
      const entries = [];

      for (const [userId, results] of Object.entries(cfg.results ?? {})) {
        if (mode) {
          if (results[mode]) entries.push({ userId, tier: results[mode].tier });
        } else {
          const first = Object.entries(results)[0];
          if (first) entries.push({ userId, mode: first[0], tier: first[1].tier });
        }
      }

      const rankValue = t => {
        const i = TIERS.indexOf(t);
        return i < 0 ? 999 : i;
      };
      entries.sort((a,b) => rankValue(a.tier) - rankValue(b.tier));

      const shown = entries.slice(0, 15).map((e, i) =>
        `${i + 1}. <@${e.userId}> — **${e.tier}**${e.mode ? ` (${e.mode})` : ''}`
      );

      await interaction.reply({
        content: shown.length
          ? `🏆 **${mode ? `${mode} ` : ''}Tier Leaderboard**\n\n${shown.join('\n')}`
          : 'No tier results yet.',
        ephemeral: false
      });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'tt_queue_mode') {
      const mode = interaction.values[0];
      const ticket = await createQueueTicket(interaction, mode);
      return interaction.update({content:`🎫 **${aestheticMode(mode)} ticket created!**\nQueue position: **#${ticket.position}**\n${ticket.channel}`, components:[]});
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'tt_apply') {
        const modal = new ModalBuilder().setCustomId('tt_apply_modal').setTitle('Tier Test Application');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('gamertag').setLabel('Minecraft Gamertag').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('mode').setLabel('Gamemode').setPlaceholder('Sword / Axe / Crystal...').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('note').setLabel('Note (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(200))
        );
        return interaction.showModal(modal);
      }
      const db2=await readDB(), cfg2=db2[interaction.guild.id];
      if (!cfg2) return interaction.reply({content:'⚠️ Run `/setup` first.',ephemeral:true});
      cfg2.queue ??= [];
      if (interaction.customId === 'tt_queue_join') {
        const menu = new StringSelectMenuBuilder().setCustomId('tt_queue_mode').setPlaceholder('Select the gamemode you want to test').addOptions(
          MODES.map(m => new StringSelectMenuOptionBuilder().setLabel(m).setValue(m).setEmoji(modeEmoji(m)))
        );
        return interaction.reply({content:'🎮 **Choose your testing gamemode:**', components:[new ActionRowBuilder().addComponents(menu)], ephemeral:true});
      }
      if (interaction.customId === 'tt_queue_leave') {
        cfg2.queue ??= {};
        let removed = false;
        for (const mode of MODES) {
          const list = cfg2.queue[mode] ?? [];
          if (list.includes(interaction.user.id)) { cfg2.queue[mode] = list.filter(id=>id!==interaction.user.id); removed = true; }
        }
        await writeDB(db2);
        return interaction.reply({content:removed ? '✅ You have left your active testing queue(s).' : 'ℹ️ You are not currently in a queue.',ephemeral:true});
      }
      if (interaction.customId === 'tt_queue_view') {
        cfg2.queue ??= {};
        const text = MODES.map(mode => { const list = cfg2.queue[mode] ?? []; return list.length ? `${modeEmoji(mode)} **${aestheticMode(mode)}** — ${list.length} waiting\n${list.slice(0,8).map((id,i)=>`**${i+1}.** <@${id}>`).join('\n')}` : ''; }).filter(Boolean).join('\n\n') || 'Queue is currently empty.';
        return interaction.reply({embeds:[new EmbedBuilder().setColor('#f59e0b').setTitle('⏳・ᴛᴇsᴛɪɴɢ ǫᴜᴇᴜᴇ').setDescription(text)],ephemeral:true});
      }
      if (interaction.isStringSelectMenu() && interaction.customId === 'tt_queue_mode') {
        const mode = interaction.values[0];
        const ticket = await createQueueTicket(interaction, mode);
        return interaction.update({content:`🎫 **${aestheticMode(mode)} ticket created!**
Queue position: **#${ticket.position}**
${ticket.channel}`, components:[]});
      }
      if (interaction.customId.startsWith('tt_ticket_close:')) {
        const mode = interaction.customId.split(':')[1];
        cfg2.queue ??= {};
        cfg2.queue[mode] = (cfg2.queue[mode] ?? []).filter(id=>id!==interaction.user.id);
        await writeDB(db2);
        await interaction.reply({content:'🔒 Closing this ticket...', ephemeral:true});
        setTimeout(() => interaction.channel?.delete('TierTestBot ticket closed').catch(()=>{}), 1200);
        return;
      }
      if (interaction.customId.startsWith('tt_ticket_claim:')) {
        const mode = interaction.customId.split(':')[1];
        const testerRoleId = cfg2.testerRoles?.[mode];
        const isTester = testerRoleId && interaction.member.roles.cache.has(testerRoleId);
        if (!isTester && !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({content:`❌ You need the **${aestheticMode(mode)} Tester** role to claim this test.`,ephemeral:true});
        return interaction.reply({content:`🧪 ${interaction.user} claimed this **${aestheticMode(mode)}** test.`,ephemeral:false});
      }
      if (interaction.customId === 'tt_leaderboard') {
        const rows=[]; for(const [uid,res] of Object.entries(cfg2.results||{})) for(const mode of MODES) if(res[mode]) rows.push({uid,tier:res[mode].tier,mode});
        rows.sort((a,b)=>TIERS.indexOf(a.tier)-TIERS.indexOf(b.tier));
        const text=rows.slice(0,20).map((r,i)=>`**${i+1}.** <@${r.uid}> — **${aestheticTier(r.tier)}** • ${aestheticMode(r.mode)}`).join('\n') || 'No results yet.';
        return interaction.reply({embeds:[new EmbedBuilder().setColor('#8b5cf6').setTitle('👑・ᴏғғɪᴄɪᴀʟ ʀᴀɴᴋɪɴɢ').setDescription(text)],ephemeral:true});
      }
      if (interaction.customId === 'tt_modes') return interaction.reply({content:MODES.map(m=>`${modeEmoji(m)} **${aestheticMode(m)}**`).join(' • '),ephemeral:true});
    }

    if (interaction.isModalSubmit() && interaction.customId === 'tt_apply_modal') {
      const db2=await readDB(), cfg2=db2[interaction.guild.id]; if(!cfg2) return interaction.reply({content:'⚠️ Run `/setup` first.',ephemeral:true});
      cfg2.applications ??= [];
      const application={id:Date.now().toString(36),userId:interaction.user.id,gamertag:interaction.fields.getTextInputValue('gamertag'),mode:interaction.fields.getTextInputValue('mode'),note:interaction.fields.getTextInputValue('note')||'No note',createdAt:new Date().toISOString()};
      cfg2.applications.push(application); await writeDB(db2);
      const applyChannel=cfg2.channels?.apply?interaction.guild.channels.cache.get(cfg2.channels.apply):null;
      if(applyChannel) await applyChannel.send({embeds:[new EmbedBuilder().setColor('#7c3aed').setTitle('📝・ɴᴇᴡ ᴛɪᴇʀ ᴀᴘᴘʟɪᴄᴀᴛɪᴏɴ').setDescription(`**Applicant:** ${interaction.user}\n**Gamertag:** \`${application.gamertag}\`\n**Mode:** ${application.mode}\n**Note:** ${application.note}`).setTimestamp()]}).catch(()=>{});
      return interaction.reply({content:'✅ **Application submitted!** A tester will review it.',ephemeral:true});
    }
  } catch (err) {
    console.error(err);
    const msg = '❌ Something went wrong. Check that the bot has **Manage Roles** and **Manage Channels**, and that its highest role is above the tier roles.';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg).catch(() => {});
    } else {
      await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
    }
  }
});

const missingEnv = ['DISCORD_TOKEN', 'CLIENT_ID'].filter(key => !process.env[key]?.trim());
if (missingEnv.length) {
  console.error(`[CONFIG ERROR] Missing required environment variable(s): ${missingEnv.join(', ')}`);
  console.error('Add these in Deploy Hatch → project/service → Environment Variables, then redeploy.');
  process.exitCode = 1;
} else {
  process.on('unhandledRejection', reason => console.error('[UNHANDLED REJECTION]', reason));
  process.on('uncaughtException', error => { console.error('[UNCAUGHT EXCEPTION]', error); process.exit(1); });
  client.on('error', error => console.error('[DISCORD CLIENT ERROR]', error));
  client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('[DISCORD LOGIN FAILED]', error?.stack || error);
    process.exitCode = 1;
  });
}
