import 'dotenv/config';
import {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder,
  PermissionFlagsBits, ChannelType, EmbedBuilder, AttachmentBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle
} from 'discord.js';
import fs from 'node:fs/promises';
import path from 'node:path';
let sharp = null;
try { ({ default: sharp } = await import('sharp')); }
catch (error) { console.warn('[BOOT] sharp unavailable; tier cards will use SVG fallback:', error.message); }

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

// Optional Discord Application Emojis. If you create emojis with these names in
// the Developer Portal, the bot will automatically use them; otherwise it falls
// back to normal Unicode emojis.
const APP_EMOJIS = {
  sword: 'tt_sword', axe: 'tt_axe', mace: 'tt_mace', uhc: 'tt_heart',
  pot: 'tt_pot', nethpot: 'tt_fire', smp: 'tt_shield', crystal: 'tt_crystal',
  bedrock: 'tt_bedrock', combo: 'tt_combo', tier: 'tt_tier', tester: 'tt_tester',
  player: 'tt_player', note: 'tt_note', stats: 'tt_stats'
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
    .setDescription('Create the Minecraft tier-testing roles and channels.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('test')
    .setDescription('Give a player a tier role for a gamemode.')
    .addUserOption(o => o.setName('player').setDescription('Player to rank').setRequired(true))
    .addStringOption(o => o.setName('mode').setDescription('Minecraft gamemode').setRequired(true)
      .addChoices(...MODES.map(m => ({ name: m, value: m })) ))
    .addStringOption(o => o.setName('tier').setDescription('Tier').setRequired(true)
      .addChoices(...TIERS.map(t => ({ name: t, value: t })) )),
  new SlashCommandBuilder()
    .setName('tier')
    .setDescription('Create a premium tier-result card and assign the tier role.')
    .addUserOption(o => o.setName('player').setDescription('Discord player').setRequired(true))
    .addStringOption(o => o.setName('gamertag').setDescription('Minecraft gamertag').setRequired(true))
    .addStringOption(o => o.setName('rank').setDescription('Tier rank').setRequired(true)
      .addChoices(...TIERS.map(t => ({ name: t, value: t })) ))
    .addStringOption(o => o.setName('gm').setDescription('Gamemode').setRequired(true)
      .addChoices(...MODES.map(m => ({ name: m, value: m })) ))
    .addStringOption(o => o.setName('note').setDescription('Test note').setRequired(false))
    .addStringOption(o => o.setName('region').setDescription('Region, e.g. AS').setRequired(false))
    .addStringOption(o => o.setName('device').setDescription('Device, e.g. Mobile').setRequired(false)),
  new SlashCommandBuilder()
    .setName('profile')
    .setDescription("Show a player's full tier profile.")
    .addUserOption(o => o.setName('member').setDescription('Discord member').setRequired(true)),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the server tier leaderboard.')
    .addStringOption(o => o.setName('mode').setDescription('Gamemode').setRequired(false)
      .addChoices(...MODES.map(m => ({ name: m, value: m })) )),
  new SlashCommandBuilder()
    .setName('modes')
    .setDescription('List all configured Minecraft testing modes.')
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
      { name: '🎮 ᴄᴏᴍᴍᴀɴᴅs', value: '`/setup` • Setup roles/channels\n`/test` • Assign a tier\n`/rank` • Post a full result + card\n`/tier` • Generate the premium tier card\n`/profile member:@player` • View profile\n`/history` • Coming next\n`/leaderboard` • View rankings\n`/modes` • View gamemodes' },
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
  if (type === 'apply') return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tt_apply').setLabel('Apply Now').setEmoji('📝').setStyle(ButtonStyle.Primary))];
  if (type === 'queue') return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tt_queue_join').setLabel('Join Queue').setEmoji('➕').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('tt_queue_leave').setLabel('Leave Queue').setEmoji('➖').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('tt_queue_view').setLabel('View Queue').setEmoji('👀').setStyle(ButtonStyle.Primary))];
  if (type === 'ranking') return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tt_leaderboard').setLabel('View Leaderboard').setEmoji('👑').setStyle(ButtonStyle.Primary))];
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

async function buildTierCard({ player, gamertag, mode, tier, tester, previousTier, note, region = 'AS', device = 'Mobile' }) {
  const accent = tierAccent(tier);
  const accentRgb = accent.replace('#', '');
  let skinData = null;
  try {
    const skinUrl = `https://mc-heads.net/body/${encodeURIComponent(gamertag)}/right`;
    const res = await fetch(skinUrl, { signal: AbortSignal.timeout(8000) });
    if (res.ok) skinData = Buffer.from(await res.arrayBuffer()).toString('base64');
  } catch {}

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
    <text x="430" y="215" fill="${accent}" font-size="25" font-weight="700" font-family="Arial, sans-serif">${escapeXml(mode.toUpperCase())}</text>
    <text x="430" y="330" fill="${accent}" font-size="104" font-weight="900" font-family="Arial, sans-serif">${escapeXml(aestheticTier(tier))}</text>
    <text x="435" y="375" fill="#8e97ad" font-size="18" font-family="Arial, sans-serif" letter-spacing="3">${escapeXml(region.toUpperCase())}  •  ${escapeXml(device.toUpperCase())}  •  TESTED BY ${escapeXml(tester.username.toUpperCase())}</text>
    <rect x="430" y="420" width="620" height="2" fill="#ffffff" opacity="0.12"/>
    <text x="430" y="465" fill="#b7bfd0" font-size="20" font-family="Arial, sans-serif">PREVIOUS: ${escapeXml(previousTier ? aestheticTier(previousTier) : 'UNRANKED')}</text>
    <text x="430" y="505" fill="#b7bfd0" font-size="20" font-family="Arial, sans-serif">NOTE: ${escapeXml(note || 'ggs')}</text>
    <text x="430" y="565" fill="#697287" font-size="16" font-family="Arial, sans-serif" letter-spacing="4">TIerTESTBOT • MINECRAFT PVP RANKINGS</text>
  </svg>`;
  if (sharp) {
    try { return { buffer: await sharp(Buffer.from(svg)).png({ quality: 95 }).toBuffer(), ext: 'png' }; }
    catch (error) { console.error('[CARD] PNG render failed; using SVG fallback:', error.message); }
  }
  return { buffer: Buffer.from(svg), ext: 'svg' };
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
        `Use **/test** for a test assignment or **/tier** for the official premium image card.`
      );
      return;
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
        tester: interaction.user.id,
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
          { name: `${appEmoji('tester','🧪')} Tested By`, value: `${interaction.user}`, inline: true }
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
      cfg.results[player.id][mode] = { tier, gamertag, note, region, device, tester: interaction.user.id, updatedAt: new Date().toISOString() };
      await writeDB(db);

      await interaction.deferReply();
      const image = await buildTierCard({ player, gamertag, mode, tier, tester: interaction.user, previousTier, note, region, device });
      const cardFile = `tier-${player.id}-${mode.toLowerCase()}.${image.ext}`;
      const attachment = new AttachmentBuilder(image.buffer, { name: cardFile });
      const embed = new EmbedBuilder()
        .setColor(tierAccent(tier))
        .setAuthor({ name: `${appEmoji('tier','⚔️')} TierTestBot • Tier Update`, iconURL: client.user.displayAvatarURL() })
        .setTitle(`${modeEmoji(mode)} ${aestheticMode(mode)} • ${aestheticTier(tier)}`)
        .setThumbnail(player.displayAvatarURL({ size: 512, extension: 'png' }))
        .setDescription(`${appEmoji('player','👤')} ${player} • \`${gamertag}\``)
        .addFields(
          { name: '🏆 Rank Earned', value: `**${aestheticTier(tier)}**`, inline: true },
          { name: '📈 Previous', value: previousTier ? `**${aestheticTier(previousTier)}**` : '`UNRANKED`', inline: true },
          { name: `${appEmoji('tester','🧪')} Tester`, value: `${interaction.user}`, inline: true },
          { name: '🌍 Region', value: region, inline: true },
          { name: '📱 Device', value: device, inline: true },
          { name: `${appEmoji('note','📝')} Note`, value: note, inline: false }
        )
        .setImage(`attachment://${cardFile}`)
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
        if (!cfg2.queue.includes(interaction.user.id)) cfg2.queue.push(interaction.user.id);
        await writeDB(db2);
        return interaction.reply({content:`⏳ You are **#${cfg2.queue.indexOf(interaction.user.id)+1}** in the testing queue.`,ephemeral:true});
      }
      if (interaction.customId === 'tt_queue_leave') {
        cfg2.queue=cfg2.queue.filter(id=>id!==interaction.user.id); await writeDB(db2);
        return interaction.reply({content:'✅ You have left the testing queue.',ephemeral:true});
      }
      if (interaction.customId === 'tt_queue_view') {
        const text=cfg2.queue.length ? cfg2.queue.slice(0,20).map((id,i)=>`**${i+1}.** <@${id}>`).join('\n') : 'Queue is currently empty.';
        return interaction.reply({embeds:[new EmbedBuilder().setColor('#f59e0b').setTitle('⏳・ᴛᴇsᴛɪɴɢ ǫᴜᴇᴜᴇ').setDescription(text)],ephemeral:true});
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

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
  console.error('[CONFIG ERROR] Missing DISCORD_TOKEN or CLIENT_ID environment variable.');
  process.exit(1);
}
console.log('[BOOT] TierTestBot v6.1 starting...');
console.log('[BOOT] DISCORD_TOKEN present:', Boolean(process.env.DISCORD_TOKEN.trim()));
console.log('[BOOT] CLIENT_ID present:', Boolean(process.env.CLIENT_ID.trim()));
client.on('error', error => console.error('[CLIENT ERROR]', error?.stack || error));
process.on('unhandledRejection', error => console.error('[UNHANDLED REJECTION]', error?.stack || error));
process.on('uncaughtException', error => { console.error('[UNCAUGHT EXCEPTION]', error?.stack || error); process.exit(1); });
client.login(process.env.DISCORD_TOKEN).then(() => console.log('[BOOT] Discord login initiated.')).catch(error => { console.error('[LOGIN ERROR]', error?.stack || error); process.exit(1); });
