/**
 * TierTestBot — Discord runtime.
 *
 * Everything the bot touches goes through the shared store, so the dashboard
 * (running as a separate Vercel deployment) always sees the same live data.
 */
import {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder,
  PermissionFlagsBits, ChannelType, EmbedBuilder, AttachmentBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle
} from 'discord.js';
import {
  MODES, TIERS, HIGH_TIERS, MODE_ICONS, APP_EMOJIS,
  aestheticMode, aestheticTier, roleName, testerRoleName, tierAccent, tierRank
} from './config.js';
import { buildTierCard } from './cards.js';
import { panelEmbed, panelRows } from './embeds.js';
import {
  KEYS, logEvent, readGuild, writeGuild, enqueueAction,
  claimAction, completeAction
} from './store.js';

const FOOTER = 'TierTestBot • Minecraft PvP Rankings';

export function createBot({ store, version = '6.2.0' }) {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent]
  });

  let startedAt = null;
  let sessionId = null;
  let stopping = false;

  const log = (level, scope, message, meta) => logEvent(store, level, scope, message, meta);

  /* ------------------------------------------------------------ helpers -- */

  function appEmoji(key, fallback) {
    const name = APP_EMOJIS[key];
    if (!name || !client.application?.emojis?.cache) return fallback;
    const emoji = client.application.emojis.cache.find(e => e.name === name);
    return emoji ? emoji.toString() : fallback;
  }

  function modeEmoji(mode) {
    const keys = { Sword: 'sword', Axe: 'axe', Mace: 'mace', UHC: 'uhc', Pot: 'pot', NethPot: 'nethpot', SMP: 'smp', Crystal: 'crystal', Bedrock: 'bedrock', Combo: 'combo' };
    return appEmoji(keys[mode], MODE_ICONS[mode] || '🎮');
  }

  const slashCommands = () => [
    new SlashCommandBuilder()
      .setName('setup')
      .setDescription('Create the Minecraft tier-testing roles and channels.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder()
      .setName('test')
      .setDescription('Give a player a tier role for a gamemode.')
      .addUserOption(o => o.setName('player').setDescription('Player to rank').setRequired(true))
      .addStringOption(o => o.setName('mode').setDescription('Minecraft gamemode').setRequired(true)
        .addChoices(...MODES.map(m => ({ name: m, value: m }))))
      .addStringOption(o => o.setName('tier').setDescription('Tier').setRequired(true)
        .addChoices(...TIERS.map(t => ({ name: t, value: t })))),
    new SlashCommandBuilder()
      .setName('tier')
      .setDescription('Create a premium tier-result card and assign the tier role.')
      .addUserOption(o => o.setName('player').setDescription('Discord player').setRequired(true))
      .addStringOption(o => o.setName('gamertag').setDescription('Minecraft gamertag').setRequired(true))
      .addStringOption(o => o.setName('rank').setDescription('Tier rank').setRequired(true)
        .addChoices(...TIERS.map(t => ({ name: t, value: t }))))
      .addStringOption(o => o.setName('gm').setDescription('Gamemode').setRequired(true)
        .addChoices(...MODES.map(m => ({ name: m, value: m }))))
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
        .addChoices(...MODES.map(m => ({ name: m, value: m })))),
    new SlashCommandBuilder()
      .setName('modes')
      .setDescription('List all configured Minecraft testing modes.')
  ].map(c => c.toJSON());

  async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: slashCommands() });
  }

  async function getOrCreateRole(guild, name) {
    let role = guild.roles.cache.find(r => r.name === name);
    if (!role) {
      role = await guild.roles.create({ name, reason: 'TierTestBot automatic tier setup' });
    }
    return role;
  }

  async function setupGuild(guild) {
    const cfg = (await readGuild(store, guild.id)) || { roles: {}, results: {} };
    cfg.roles ??= {};
    cfg.results ??= {};
    cfg.testerRoles ??= {};

    for (const mode of MODES) {
      cfg.roles[mode] ??= {};
      for (const tier of TIERS) {
        const desiredName = roleName(mode, tier);
        let role = guild.roles.cache.find(r => r.name === desiredName);
        if (!role) {
          // Reuse and rename an older TierTestBot role if it exists.
          role = guild.roles.cache.find(r => r.name === `${mode} • ${tier}`);
        }
        if (!role) role = await getOrCreateRole(guild, desiredName);
        else if (role.name !== desiredName) {
          role = await role.setName(desiredName, 'TierTestBot aesthetic role update');
        }
        cfg.roles[mode][tier] = role.id;
      }
      const testerName = testerRoleName(mode);
      let testerRole = guild.roles.cache.find(r => r.name === testerName);
      if (!testerRole) testerRole = await getOrCreateRole(guild, testerName);
      cfg.testerRoles[mode] = testerRole.id;
    }

    const categoryName = '🧪・TIER TESTING';
    let category = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && (c.name === categoryName || c.name === '⚔️ TIER TESTING')
    );
    if (category && category.name !== categoryName) {
      try { await category.setName(categoryName, 'TierTestBot aesthetic setup update'); } catch { /* ignore */ }
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

    cfg.channels ??= {};
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
      cfg.channels[key] = ch.id;
    }

    const resultsChannel = guild.channels.cache.get(cfg.channels.results);
    const highResultsChannel = guild.channels.cache.get(cfg.channels.high);
    cfg.resultsChannel = resultsChannel?.id;
    cfg.highResultsChannel = highResultsChannel?.id;
    cfg.name = guild.name;
    cfg.memberCount = guild.memberCount ?? null;
    cfg.icon = guild.iconURL?.() ?? null;

    await writeGuild(store, guild.id, cfg);
    await postPanels(guild, cfg);
    return cfg;
  }

  async function postPanels(guild, cfg) {
    const mapping = { rules: 'rules', kits: 'kits', apply: 'apply', queue: 'queue', results: 'results', high: 'high', ranking: 'ranking', punishment: 'punishment', content: 'content' };
    for (const [type, key] of Object.entries(mapping)) {
      const id = cfg.channels?.[key];
      const ch = id ? guild.channels.cache.get(id) : null;
      if (!ch) continue;
      const recent = await ch.messages.fetch({ limit: 10 }).catch(() => null);
      const marker = 'TierTestBot • Official Minecraft PvP Testing';
      const has = recent?.some(m => m.author.id === client.user.id && m.embeds?.some(e => e.footer?.text === marker));
      if (!has) await sendPanel(ch, type).catch(error => log('error', 'panel', error.message));
    }
  }

  async function sendPanel(channel, type) {
    const embed = panelEmbed(type);
    const rows = panelRows(type);
    if (rows.length) return channel.send({ embeds: [embed], components: rows });
    return channel.send({ embeds: [embed] });
  }

  async function getPreviousTier(cfg, member, mode) {
    const saved = cfg.results?.[member.id]?.[mode]?.tier;
    if (saved && TIERS.includes(saved)) return saved;
    for (const tier of TIERS) {
      const roleId = cfg.roles?.[mode]?.[tier];
      if (roleId && member.roles.cache.has(roleId)) return tier;
    }
    return null;
  }

  /* ----------------------------------------------------------- heartbeat -- */

  async function writeHeartbeat(extra = {}) {
    const previous = (await store.get(KEYS.bot)) || {};
    const guilds = client.guilds?.cache
      ? [...client.guilds.cache.values()].map(g => ({
          id: g.id,
          name: g.name,
          memberCount: g.memberCount ?? null,
          icon: g.iconURL?.() ?? null
        }))
      : [];
    const state = {
      ...previous,
      ...extra,
      status: extra.status || previous.status || 'online',
      version,
      sessionId,
      startedAt: startedAt || previous.startedAt || null,
      updatedAt: new Date().toISOString(),
      heartbeatAt: Date.now(),
      user: client.user
        ? { id: client.user.id, tag: client.user.tag, username: client.user.username, avatar: client.user.displayAvatarURL?.() ?? null }
        : previous.user || null,
      guilds,
      guildCount: guilds.length,
      latency: Math.round(client.ws?.ping ?? 0),
      memory: Math.round(process.memoryUsage().rss / 1024 / 1024)
    };
    await store.set(KEYS.bot, state);
    return state;
  }

  const heartbeatTimer = setInterval(() => {
    writeHeartbeat().catch(error => console.error('[HEARTBEAT]', error.message));
  }, 15_000);
  heartbeatTimer.unref?.();

  /* -------------------------------------------------------- action queue -- */

  async function runAction(action) {
    const { type, guildId, payload = {} } = action;
    const guild = guildId ? client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null) : null;

    if (type === 'assignTier') {
      if (!guild) return { ok: false, error: 'Guild not available' };
      const cfg = await readGuild(store, guildId);
      if (!cfg) return { ok: false, error: 'Run /setup first' };
      const member = await guild.members.fetch(payload.userId).catch(() => null);
      if (!member) return { ok: false, error: 'Member not found' };
      const roleId = cfg.roles?.[payload.mode]?.[payload.tier];
      const role = roleId ? guild.roles.cache.get(roleId) : null;
      if (!role) return { ok: false, error: 'Tier role missing — run /setup again' };

      const previousTier = await getPreviousTier(cfg, member, payload.mode);
      for (const oldTier of TIERS) {
        const oldId = cfg.roles?.[payload.mode]?.[oldTier];
        if (oldId && member.roles.cache.has(oldId)) {
          await member.roles.remove(oldId, 'TierTestBot tier update');
        }
      }
      await member.roles.add(role, 'TierTestBot tier result');

      cfg.results ??= {};
      cfg.results[member.id] ??= {};
      cfg.results[member.id][payload.mode] = {
        ...(cfg.results[member.id][payload.mode] || {}),
        tier: payload.tier,
        gamertag: payload.gamertag || cfg.results[member.id][payload.mode]?.gamertag,
        note: payload.note || cfg.results[member.id][payload.mode]?.note || 'ggs',
        region: payload.region || cfg.results[member.id][payload.mode]?.region || 'AS',
        device: payload.device || cfg.results[member.id][payload.mode]?.device || 'Mobile',
        tester: payload.testerId || action.requestedBy || member.id,
        updatedAt: new Date().toISOString()
      };
      await writeGuild(store, guildId, cfg);

      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setAuthor({ name: `${appEmoji('tier', '⚔️')} TierTestBot • Tier Result`, iconURL: client.user.displayAvatarURL() })
        .setTitle(`${modeEmoji(payload.mode)} ${aestheticMode(payload.mode)} • ${aestheticTier(payload.tier)}`)
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setDescription(`${appEmoji('player', '👤')} **Player** ${member.user}`)
        .addFields(
          { name: `${appEmoji('tier', '🏆')} Rank Earned`, value: `**${aestheticTier(payload.tier)}**`, inline: true },
          { name: '📈 Previous', value: previousTier ? `**${aestheticTier(previousTier)}**` : '`NOT TESTED`', inline: true },
          { name: `${appEmoji('tester', '🧪')} Tested By`, value: payload.testerTag || '`Dashboard`', inline: true }
        )
        .setFooter({ text: FOOTER })
        .setTimestamp();

      const channel = cfg.resultsChannel ? guild.channels.cache.get(cfg.resultsChannel) : null;
      if (channel) await channel.send({ embeds: [embed] }).catch(() => {});
      return { ok: true, message: `${member.user.tag} ranked ${aestheticTier(payload.tier)} in ${payload.mode}` };
    }

    if (type === 'syncSetup' || type === 'postPanels') {
      if (!guild) return { ok: false, error: 'Guild not available' };
      const cfg = await setupGuild(guild);
      return { ok: true, message: `Synced ${Object.keys(cfg.roles || {}).length} modes` };
    }

    if (type === 'approveApplication' || type === 'rejectApplication') {
      if (!guild) return { ok: false, error: 'Guild not available' };
      const cfg = await readGuild(store, guildId);
      if (!cfg) return { ok: false, error: 'Run /setup first' };
      const application = (cfg.applications || []).find(a => a.id === payload.applicationId);
      if (!application) return { ok: false, error: 'Application not found' };
      application.status = type === 'approveApplication' ? 'approved' : 'rejected';
      application.handledAt = new Date().toISOString();
      await writeGuild(store, guildId, cfg);
      const applyChannel = cfg.channels?.apply ? guild.channels.cache.get(cfg.channels.apply) : null;
      if (applyChannel) {
        await applyChannel.send({
          embeds: [new EmbedBuilder()
            .setColor(type === 'approveApplication' ? '#22c55e' : '#ef4444')
            .setTitle(type === 'approveApplication' ? '✅・ɴᴇᴡ ᴛɪᴇʀ ᴀᴘᴘʟɪᴄᴀᴛɪᴏɴ ᴀᴘᴘʀᴏᴠᴇᴅ' : '❌・ɴᴇᴡ ᴛɪᴇʀ ᴀᴘᴘʟɪᴄᴀᴛɪᴏɴ ʀᴇᴊᴇᴄᴛᴇᴅ')
            .setDescription(`**Applicant:** <@${application.userId}>\n**Gamertag:** \`${application.gamertag}\`\n**Mode:** ${application.mode}\n**Handled by:** ${payload.testerTag || 'Dashboard'}`)
            .setTimestamp()]
        }).catch(() => {});
      }
      return { ok: true, message: `Application ${application.status}` };
    }

    if (type === 'stop' || type === 'restart') {
      stopping = true;
      setTimeout(() => client.destroy(), 200).unref?.();
      return { ok: true, message: `Bot ${type} requested` };
    }

    return { ok: false, error: `Unknown action ${type}` };
  }

  async function pollActions() {
    let actions = [];
    try {
      actions = await store.list(KEYS.queue);
    } catch {
      return;
    }
    for (const action of actions) {
      if (action.status !== 'pending') continue;
      await claimAction(store, action.id);
      try {
        const result = await runAction(action);
        await completeAction(store, action.id, result);
        await log('info', 'action', `${action.type} → ${result?.ok ? 'ok' : 'failed'}`, result);
      } catch (error) {
        await completeAction(store, action.id, { ok: false, error: error.message });
        await log('error', 'action', `${action.type} threw: ${error.message}`);
      }
    }
  }

  const actionTimer = setInterval(() => { pollActions().catch(() => {}); }, 3_000);
  actionTimer.unref?.();

  /* ------------------------------------------------------------- events -- */

  client.once('ready', async () => {
    startedAt = new Date().toISOString();
    await writeHeartbeat({ status: 'online', startedAt });
    await log('info', 'bot', `Logged in as ${client.user.tag} (${client.guilds.cache.size} guilds)`);
    try {
      await registerCommands();
      await log('info', 'bot', 'Slash commands registered.');
    } catch (error) {
      await log('error', 'bot', `Command registration failed: ${error.message}`);
    }
    // Keep guild metadata fresh for the dashboard.
    for (const guild of client.guilds.cache.values()) {
      const cfg = (await readGuild(store, guild.id)) || { roles: {}, results: {} };
      cfg.name = guild.name;
      cfg.memberCount = guild.memberCount ?? null;
      cfg.icon = guild.iconURL?.() ?? null;
      await writeGuild(store, guild.id, cfg);
    }
    await writeHeartbeat();
  });

  client.on('error', error => {
    console.error('[CLIENT ERROR]', error?.stack || error);
    log('error', 'client', error?.message || String(error));
  });

  client.on('shardDisconnect', event => log('warn', 'gateway', `Disconnected (code ${event?.code})`));
  client.on('shardReconnecting', () => log('warn', 'gateway', 'Reconnecting…'));
  client.on('shardResume', () => log('info', 'gateway', 'Session resumed'));

  client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    if (!message.content.toLowerCase().startsWith('-help')) return;
    const embed = new EmbedBuilder()
      .setTitle('⚔️ ᴛɪᴇʀᴛᴇsᴛʙᴏᴛ • ʜᴇʟᴘ')
      .setDescription('**Minecraft PvP Tier Testing**')
      .addFields(
        { name: '🎮 ᴄᴏᴍᴍᴀɴᴅs', value: '`/setup` • Setup roles/channels\n`/test` • Assign a tier\n`/tier` • Post a full result + card\n`/profile member:@player` • View profile\n`/leaderboard` • View rankings\n`/modes` • View gamemodes' },
        { name: '🧪 ᴛᴇsᴛᴇʀ ʀᴏʟᴇs', value: MODES.map(m => `${MODE_ICONS[m]} ${aestheticMode(m)} Tester`).join(' • ') }
      )
      .setFooter({ text: 'TierTestBot • Type -help anytime' });
    await message.reply({ embeds: [embed] });
  });

  client.on('interactionCreate', async interaction => {
    if (!interaction.guild) return;
    try {
      await handleInteraction(interaction);
    } catch (err) {
      console.error(err);
      await log('error', 'interaction', err.message);
      const msg = '❌ Something went wrong. Check that the bot has **Manage Roles** and **Manage Channels**, and that its highest role is above the tier roles.';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(msg).catch(() => {});
      } else {
        await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
      }
    }
  });

  async function handleInteraction(interaction) {
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

    const cfg = await readGuild(store, interaction.guild.id);
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

      const previousTier = await getPreviousTier(cfg, member, mode);

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
      await writeGuild(store, interaction.guild.id, cfg);

      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setAuthor({ name: `${appEmoji('tier', '⚔️')} TierTestBot • Tier Result`, iconURL: client.user.displayAvatarURL() })
        .setTitle(`${modeEmoji(mode)} ${aestheticMode(mode)} • ${aestheticTier(tier)}`)
        .setThumbnail(player.displayAvatarURL({ size: 256 }))
        .setDescription(`${appEmoji('player', '👤')} **Player** ${player}`)
        .addFields(
          { name: `${appEmoji('tier', '🏆')} Rank Earned`, value: `**${aestheticTier(tier)}**`, inline: true },
          { name: '📈 Previous', value: previousTier ? `**${aestheticTier(previousTier)}**` : '`NOT TESTED`', inline: true },
          { name: `${appEmoji('tester', '🧪')} Tested By`, value: `${interaction.user}`, inline: true }
        )
        .setFooter({ text: FOOTER })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      const channel = cfg.resultsChannel ? interaction.guild.channels.cache.get(cfg.resultsChannel) : null;
      if (channel && channel.id !== interaction.channel.id) await channel.send({ embeds: [embed] });
      await log('info', 'command', `/test ${player.tag} → ${tier} (${mode})`);
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
      cfg.results[player.id][mode] = {
        tier, gamertag, note, region, device,
        tester: interaction.user.id,
        updatedAt: new Date().toISOString()
      };
      await writeGuild(store, interaction.guild.id, cfg);

      await interaction.deferReply();
      const image = await buildTierCard({ gamertag, mode, tier, tester: interaction.user, previousTier, note, region, device });
      const cardFile = `tier-${player.id}-${mode.toLowerCase()}.${image.ext}`;
      const attachment = new AttachmentBuilder(image.buffer, { name: cardFile });
      const embed = new EmbedBuilder()
        .setColor(tierAccent(tier))
        .setAuthor({ name: `${appEmoji('tier', '⚔️')} TierTestBot • Tier Update`, iconURL: client.user.displayAvatarURL() })
        .setTitle(`${modeEmoji(mode)} ${aestheticMode(mode)} • ${aestheticTier(tier)}`)
        .setThumbnail(player.displayAvatarURL({ size: 512, extension: 'png' }))
        .setDescription(`${appEmoji('player', '👤')} ${player} • \`${gamertag}\``)
        .addFields(
          { name: '🏆 Rank Earned', value: `**${aestheticTier(tier)}**`, inline: true },
          { name: '📈 Previous', value: previousTier ? `**${aestheticTier(previousTier)}**` : '`UNRANKED`', inline: true },
          { name: `${appEmoji('tester', '🧪')} Tester`, value: `${interaction.user}`, inline: true },
          { name: '🌍 Region', value: region, inline: true },
          { name: '📱 Device', value: device, inline: true },
          { name: `${appEmoji('note', '📝')} Note`, value: note, inline: false }
        )
        .setImage(`attachment://${cardFile}`)
        .setFooter({ text: FOOTER })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed], files: [attachment] });
      const channel = cfg.resultsChannel ? interaction.guild.channels.cache.get(cfg.resultsChannel) : null;
      if (channel && channel.id !== interaction.channel.id) await channel.send({ embeds: [embed], files: [attachment] });
      if (HIGH_TIERS.includes(tier) && cfg.highResultsChannel) {
        const high = interaction.guild.channels.cache.get(cfg.highResultsChannel);
        if (high && high.id !== interaction.channel.id) await high.send({ embeds: [embed], files: [attachment] }).catch(() => {});
      }
      await log('info', 'command', `/tier ${player.tag} → ${tier} (${mode}) by ${interaction.user.tag}`);
      return;
    }

    if (interaction.commandName === 'profile') {
      const player = interaction.options.getUser('member');
      const results = cfg.results?.[player.id] || {};
      const testedCount = MODES.filter(m => results[m]).length;
      const last = Object.values(results).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
      const lastDate = last?.updatedAt ? `<t:${Math.floor(new Date(last.updatedAt).getTime() / 1000)}:R>` : '`Never`';
      const gamertag = Object.values(results).find(r => r.gamertag)?.gamertag || 'Not set';

      const modeFields = MODES.map(mode => {
        const result = results[mode];
        if (!result) {
          return { name: `${modeEmoji(mode)} ${aestheticMode(mode)}`, value: '`NOT TESTED`', inline: true };
        }
        return {
          name: `${modeEmoji(mode)} ${aestheticMode(mode)}`,
          value: `**${aestheticTier(result.tier)}**\n${appEmoji('tester', '🧪')} ${result.tester ? `<@${result.tester}>` : '`Unknown`'}`,
          inline: true
        };
      });

      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setAuthor({ name: `${appEmoji('tier', '⚔️')} TierTestBot • Player Profile`, iconURL: client.user.displayAvatarURL() })
        .setTitle(`${player.username}'s Tier Profile`)
        .setThumbnail(player.displayAvatarURL({ size: 512, extension: 'png' }))
        .setDescription(`${appEmoji('player', '👤')} **Discord:** ${player}\n🎮 **Minecraft:** \`${gamertag}\`\n\n${appEmoji('stats', '📊')} **${testedCount}/${MODES.length}** gamemodes tested`)
        .addFields(modeFields)
        .addFields({ name: '📌 Profile Stats', value: `**Tests:** ${testedCount}/${MODES.length}\n**Last Tested:** ${lastDate}`, inline: false })
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
      entries.sort((a, b) => tierRank(a.tier) - tierRank(b.tier));
      const shown = entries.slice(0, 15).map((e, i) => `${i + 1}. <@${e.userId}> — **${e.tier}**${e.mode ? ` (${e.mode})` : ''}`);
      await interaction.reply({
        content: shown.length
          ? `🏆 **${mode ? `${mode} ` : ''}Tier Leaderboard**\n\n${shown.join('\n')}`
          : 'No tier results yet.',
        ephemeral: false
      });
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'tt_apply') {
        const modal = new ModalBuilder().setCustomId('tt_apply_modal').setTitle('Tier Test Application');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('gamertag').setLabel('Minecraft Gamertag').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('mode').setLabel('Gamemode').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('note').setLabel('Note (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(200))
        );
        return interaction.showModal(modal);
      }

      const cfg2 = await readGuild(store, interaction.guild.id);
      if (!cfg2) return interaction.reply({ content: '⚠️ Run `/setup` first.', ephemeral: true });
      cfg2.queue ??= [];
      if (interaction.customId === 'tt_queue_join') {
        if (!cfg2.queue.includes(interaction.user.id)) cfg2.queue.push(interaction.user.id);
        await writeGuild(store, interaction.guild.id, cfg2);
        return interaction.reply({ content: `⏳ You are **#${cfg2.queue.indexOf(interaction.user.id) + 1}** in the testing queue.`, ephemeral: true });
      }
      if (interaction.customId === 'tt_queue_leave') {
        cfg2.queue = cfg2.queue.filter(id => id !== interaction.user.id);
        await writeGuild(store, interaction.guild.id, cfg2);
        return interaction.reply({ content: '✅ You have left the testing queue.', ephemeral: true });
      }
      if (interaction.customId === 'tt_queue_view') {
        const text = cfg2.queue.length
          ? cfg2.queue.slice(0, 20).map((id, i) => `**${i + 1}.** <@${id}>`).join('\n')
          : 'Queue is currently empty.';
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#f59e0b').setTitle('⏳・ᴛᴇsᴛɪɴɢ ǫᴜᴇᴜᴇ').setDescription(text)], ephemeral: true });
      }
      if (interaction.customId === 'tt_leaderboard') {
        const rows = [];
        for (const [uid, res] of Object.entries(cfg2.results || {})) {
          for (const mode of MODES) if (res[mode]) rows.push({ uid, tier: res[mode].tier, mode });
        }
        rows.sort((a, b) => tierRank(a.tier) - tierRank(b.tier));
        const text = rows.slice(0, 20).map((r, i) => `**${i + 1}.** <@${r.uid}> — **${aestheticTier(r.tier)}** • ${aestheticMode(r.mode)}`).join('\n') || 'No results yet.';
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#8b5cf6').setTitle('👑・ᴏғғɪᴄɪᴀʟ ʀᴀɴᴋɪɴɢ').setDescription(text)], ephemeral: true });
      }
      if (interaction.customId === 'tt_modes') {
        return interaction.reply({ content: MODES.map(m => `${modeEmoji(m)} **${aestheticMode(m)}**`).join(' • '), ephemeral: true });
      }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'tt_apply_modal') {
      const cfg2 = await readGuild(store, interaction.guild.id);
      if (!cfg2) return interaction.reply({ content: '⚠️ Run `/setup` first.', ephemeral: true });
      cfg2.applications ??= [];
      const application = {
        id: Date.now().toString(36),
        userId: interaction.user.id,
        gamertag: interaction.fields.getTextInputValue('gamertag'),
        mode: interaction.fields.getTextInputValue('mode'),
        note: interaction.fields.getTextInputValue('note') || 'No note',
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      cfg2.applications.push(application);
      await writeGuild(store, interaction.guild.id, cfg2);
      const applyChannel = cfg2.channels?.apply ? interaction.guild.channels.cache.get(cfg2.channels.apply) : null;
      if (applyChannel) {
        await applyChannel.send({
          embeds: [new EmbedBuilder()
            .setColor('#7c3aed')
            .setTitle('📝・ɴᴇᴡ ᴛɪᴇʀ ᴀᴘᴘʟɪᴄᴀᴛɪᴏɴ')
            .setDescription(`**Applicant:** ${interaction.user}\n**Gamertag:** \`${application.gamertag}\`\n**Mode:** ${application.mode}\n**Note:** ${application.note}`)
            .setTimestamp()]
        }).catch(() => {});
      }
      return interaction.reply({ content: '✅ **Application submitted!** A tester will review it.', ephemeral: true });
    }
  }

  /* -------------------------------------------------------------- start -- */

  async function start() {
    sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    await writeHeartbeat({ status: 'connecting' });
    await client.login(process.env.DISCORD_TOKEN);
    await writeHeartbeat({ status: 'online' });
    return client;
  }

  async function stop(reason = 'shutdown') {
    stopping = true;
    await writeHeartbeat({ status: 'offline', stoppedAt: new Date().toISOString(), reason }).catch(() => {});
    try { await client.destroy(); } catch { /* ignore */ }
  }

  return { client, start, stop, writeHeartbeat, pollActions, isStopping: () => stopping, version };
}

export { enqueueAction };
