import { ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { MODES, TIERS, CHANNEL_PLAN, TESTING_CATEGORY_NAME, TICKET_CATEGORY_NAME, roleName, testerRoleName } from './constants.js';
import { logger } from './logger.js';

async function getOrCreateRole(guild, name, reason) {
  let role = guild.roles.cache.find(r => r.name === name);
  if (!role) {
    role = await guild.roles.create({ name, reason });
    logger.info(`Created role ${name} in ${guild.name}`);
  }
  return role;
}
async function getOrCreateCategory(guild, name) {
  let cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === name);
  if (!cat) cat = await guild.channels.create({ name, type: ChannelType.GuildCategory, reason: 'TierTestBot setup' });
  return cat;
}

function panelEmbed(type) {
  const base = new EmbedBuilder().setTimestamp().setFooter({ text: 'TierTestBot • Official Minecraft PvP Testing' });
  if (type === 'apply') return base.setColor('#7c3aed').setAuthor({name:'📝 ᴛɪᴇʀᴛᴇsᴛ • ᴀᴘᴘʟɪᴄᴀᴛɪᴏɴ'}).setTitle('✦ ᴛɪᴇʀ ᴛᴇsᴛ ᴀᴘᴘʟʏ').setDescription('Ready to get tested?\n\nClick **Apply Now** and submit your Minecraft gamertag, preferred mode and a short note.\n\n> ✦ Keep your details accurate. A tester will review your application.');
  if (type === 'queue') return base.setColor('#f59e0b').setAuthor({name:'⏳ ᴛɪᴇʀᴛᴇsᴛ • ǫᴜᴇᴜᴇ'}).setTitle('✦ ᴛᴇsᴛɪɴɢ ǫᴜᴇᴜᴇ').setDescription('Join the testing queue and wait for an available tester.\n\nUse the buttons below to **join** or **leave** the queue.\n\n> Your position persists across restarts.');
  if (type === 'results') return base.setColor('#22c55e').setAuthor({name:'🏆 ᴛɪᴇʀᴛᴇsᴛ • ʀᴇsᴜʟᴛs'}).setTitle('✦ ᴏғғɪᴄɪᴀʟ ᴛɪᴇʀ ʀᴇsᴜʟᴛs').setDescription('Official tier cards and verified results are posted here automatically by **/tier**.');
  if (type === 'high') return base.setColor('#ef4444').setAuthor({name:'🔥 ᴛɪᴇʀᴛᴇsᴛ • ʜɪɢʜ ᴛɪᴇʀ'}).setTitle('✦ ʜɪɢʜ ᴛɪᴇʀ ʀᴇsᴜʟᴛs').setDescription('Top-tier results are highlighted here automatically.\n\n**HT1 • LT1 • HT2 • LT2**');
  if (type === 'ranking') return base.setColor('#8b5cf6').setAuthor({name:'👑 ᴛɪᴇʀᴛᴇsᴛ • ʀᴀɴᴋɪɴɢ'}).setTitle('✦ ᴏғғɪᴄɪᴀʟ ʀᴀɴᴋɪɴɢ').setDescription('Use **View Leaderboard** to see the current server rankings.');
  if (type === 'rules') return base.setColor('#5865f2').setTitle('📜・ᴛɪᴇʀ ʀᴜʟᴇs').setDescription('• Play fair and follow server rules.\n• No cheating, exploits or intentional abuse.\n• Respect testers and other players.\n• Results must be based on the configured testing system.');
  if (type === 'kits') return base.setColor('#14b8a6').setTitle('🧰・ᴛɪᴇʀ ᴋɪᴛs').setDescription('Testing kits and mode-specific preparation information will be listed here.');
  if (type === 'punishment') return base.setColor('#ef4444').setTitle('⚠️・ᴘᴜɴɪsʜᴍᴇɴᴛ').setDescription('Use this channel for documented moderation actions and official punishment information.');
  if (type === 'tickets') return base.setColor('#0ea5e9').setAuthor({name:'🎫 ᴛɪᴇʀᴛᴇsᴛ • ᴛɪᴄᴋᴇᴛs'}).setTitle('✦ ᴘʀɪᴠᴀᴛᴇ ᴛᴇsᴛɪɴɢ ᴛɪᴄᴋᴇᴛs').setDescription('Need a 1v1 test? Open a **private ticket** for your gamemode.\n\n• Tickets are private to you + mode testers\n• Select your gamemode below\n• Prevents duplicate tickets\n• Queue state survives restarts');
  return base.setColor('#6366f1').setTitle('📚・ᴛɪᴇʀ ᴄᴏɴᴛᴇɴᴛ').setDescription('Official tier-testing guides, clips and educational content.');
}
function panelRows(type) {
  if (type === 'apply') return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tt_apply').setLabel('Apply Now').setEmoji('📝').setStyle(ButtonStyle.Primary))];
  if (type === 'queue') return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tt_queue_join').setLabel('Join Queue').setEmoji('➕').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('tt_queue_leave').setLabel('Leave Queue').setEmoji('➖').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('tt_queue_view').setLabel('View Queue').setEmoji('👀').setStyle(ButtonStyle.Primary))];
  if (type === 'ranking') return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tt_leaderboard').setLabel('View Leaderboard').setEmoji('👑').setStyle(ButtonStyle.Primary))];
  if (type === 'results') return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tt_modes').setLabel('Testing Modes').setEmoji('🎮').setStyle(ButtonStyle.Secondary))];
  if (type === 'tickets') {
    const menu = new StringSelectMenuBuilder().setCustomId('tt_ticket_open').setPlaceholder('Select gamemode for private test').setMinValues(1).setMaxValues(1)
      .addOptions(MODES.map(m => ({ label: m, value: m, description: `Open ${m} private ticket` })));
    return [new ActionRowBuilder().addComponents(menu)];
  }
  return [];
}

export async function setupGuild(guild, db, client) {
  db[guild.id] ??= { roles: {}, results: {}, history: {}, registrations: {}, queue: [], tickets: {}, channels: {}, testerRoles: {} };
  const me = guild.members.me;
  const needed = [PermissionsBitField.Flags.ManageRoles, PermissionsBitField.Flags.ManageChannels];
  const missing = needed.filter(p => !me.permissions.has(p));
  if (missing.length) logger.warn(`Missing permissions in ${guild.name}: ${missing.join(',')}`);

  for (const mode of MODES) {
    db[guild.id].roles[mode] ??= {};
    for (const tier of TIERS) {
      const desiredName = roleName(mode, tier);
      let role = guild.roles.cache.find(r => r.name === desiredName) || guild.roles.cache.find(r => r.name === `${mode} • ${tier}`);
      if (!role) role = await getOrCreateRole(guild, desiredName, 'TierTestBot tier setup');
      else if (role.name !== desiredName) try { await role.setName(desiredName); } catch {}
      db[guild.id].roles[mode][tier] = role.id;
    }
    const testerName = testerRoleName(mode);
    let testerRole = guild.roles.cache.find(r => r.name.toLowerCase() === testerName.toLowerCase());
    if (!testerRole) testerRole = await getOrCreateRole(guild, testerName, 'TierTestBot tester role');
    db[guild.id].testerRoles ??= {};
    db[guild.id].testerRoles[mode] = testerRole.id;
  }

  let registeredRole = guild.roles.cache.find(r => r.name === 'Registered');
  if (!registeredRole) registeredRole = await getOrCreateRole(guild, 'Registered', 'TierTestBot registration role');
  db[guild.id].registeredRole = registeredRole.id;

  const testingCat = await getOrCreateCategory(guild, TESTING_CATEGORY_NAME);
  const ticketCat = await getOrCreateCategory(guild, TICKET_CATEGORY_NAME);
  db[guild.id].categories = { testing: testingCat.id, tickets: ticketCat.id };

  db[guild.id].channels ??= {};
  for (const [channelName, key] of CHANNEL_PLAN) {
    let ch = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === channelName);
    if (!ch) ch = await guild.channels.create({ name: channelName, type: ChannelType.GuildText, parent: testingCat.id, reason: 'TierTestBot setup' });
    else if (ch.parentId !== testingCat.id) try { await ch.setParent(testingCat.id); } catch {}
    db[guild.id].channels[key] = ch.id;
  }
  db[guild.id].resultsChannel = db[guild.id].channels.results;
  db[guild.id].highResultsChannel = db[guild.id].channels.high;
  await postPanels(guild, db[guild.id], client);
  return db[guild.id];
}

async function sendPanel(channel, type) {
  const embed = panelEmbed(type);
  const rows = panelRows(type);
  if (rows.length) return channel.send({ embeds:[embed], components:rows });
  return channel.send({ embeds:[embed] });
}
export async function postPanels(guild, cfg, client) {
  const mapping = { rules:'rules', kits:'kits', apply:'apply', queue:'queue', results:'results', high:'high', ranking:'ranking', punishment:'punishment', content:'content' };
  for (const [type,key] of Object.entries(mapping)) {
    const id = cfg.channels?.[key], ch = id ? guild.channels.cache.get(id) : null;
    if (!ch) continue;
    try {
      const recent = await ch.messages.fetch({ limit:10 }).catch(()=>null);
      const marker = 'TierTestBot • Official Minecraft PvP Testing';
      const has = recent?.some(m=>m.author.id===client.user.id && m.embeds?.some(e=>e.footer?.text===marker));
      if (!has) await sendPanel(ch,type).catch(e=>logger.warn(`Panel send failed for ${type}: ${e.message}`));
    } catch (e) { logger.warn(`postPanels error for ${type}: ${e.message}`); }
  }
  // Private ticket panel in the requested join-queue channel
  try {
    const ch = cfg.channels?.join ? guild.channels.cache.get(cfg.channels.join) : null;
    if (ch) {
      const recent = await ch.messages.fetch({ limit:15 }).catch(()=>null);
      const has = recent?.some(m=>m.author.id===client.user.id && m.embeds?.some(e=>e.title?.includes('ᴘʀɪᴠᴀᴛᴇ ᴛᴇsᴛɪɴɢ')));
      if (!has) await sendPanel(ch,'tickets');
    }
  } catch (e) { logger.warn(`Ticket panel error: ${e.message}`); }
}
