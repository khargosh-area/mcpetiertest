import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder,
  PermissionFlagsBits, ChannelType, EmbedBuilder, AttachmentBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } from 'discord.js';

import { logger, logError } from './src/logger.js';
import { initDB, readDB, writeDB, withDB, verifyAccess, addHistory, getHistory } from './src/db.js';
import { MODES, TIERS, MODE_ICONS, CHANNEL_PLAN, aestheticTier, aestheticMode, roleName, testerRoleName, tierAccent, tierOrder, escapeXml } from './src/constants.js';
import { commands as registeredCommands } from './src/commands.js';
import { validateGamertag, validateMode, validateTier, sanitizeNote, validateRegion, validateDevice } from './src/validation.js';
import { buildTierCard } from './src/card.js';
import { setupGuild, postPanels } from './src/setup.js';
import { createTicket, handleClaim, handleClose, handleReopen, isTesterForMode } from './src/tickets.js';

// ------------------------------------------------------------
// PRE-BOOT: ENV VALIDATION
// ------------------------------------------------------------
function validateEnv() {
  const missing = [];
  if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_TOKEN.trim()) missing.push('DISCORD_TOKEN');
  if (!process.env.CLIENT_ID || !process.env.CLIENT_ID.trim()) missing.push('CLIENT_ID');
  if (missing.length) {
    console.error(`[CONFIG ERROR] Missing required environment variables: ${missing.join(', ')}`);
    console.error(`[CONFIG ERROR] Create a .env file based on .env.example and set DISCORD_TOKEN and CLIENT_ID.`);
    console.error(`[CONFIG ERROR] Never hardcode tokens. If exposed, reset in Discord Developer Portal.`);
    process.exit(1);
  }
  // Warn if token looks placeholder
  if (process.env.DISCORD_TOKEN.includes('your_bot_token') || process.env.CLIENT_ID.includes('your_application')) {
    console.error('[CONFIG ERROR] DISCORD_TOKEN or CLIENT_ID still contains placeholder values. Set real credentials.');
    process.exit(1);
  }
  logger.boot('Environment validated');
  logger.boot(`DISCORD_TOKEN present: ${Boolean(process.env.DISCORD_TOKEN.trim())}`);
  logger.boot(`CLIENT_ID present: ${Boolean(process.env.CLIENT_ID.trim())}`);
}
validateEnv();

// Prevent duplicate processes via lockfile
const LOCKFILE = path.join(process.cwd(), 'data', '.lock');
let lockAcquired = false;
async function acquireLock() {
  await fs.mkdir(path.join(process.cwd(),'data'), { recursive:true });
  for (let attempt=0; attempt<2; attempt++) {
    try {
      const handle = await fs.open(LOCKFILE, 'wx');
      await handle.writeFile(JSON.stringify({ pid: process.pid, ts: Date.now() }));
      await handle.close();
      lockAcquired = true;
      logger.boot(`Process lock acquired (PID ${process.pid})`);
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        const existing = JSON.parse(await fs.readFile(LOCKFILE, 'utf8'));
        let alive = false;
        try { process.kill(existing.pid, 0); alive = true; } catch (e) { alive = e.code === 'EPERM'; }
        if (alive) {
          logger.error(`Duplicate process detected: PID ${existing.pid} owns ${LOCKFILE}. Exiting to prevent duplicate bot sessions.`);
          process.exit(1);
        }
        logger.warn(`Removing stale process lock for PID ${existing.pid || 'unknown'}`);
        await fs.unlink(LOCKFILE);
      } catch (readError) {
        if (readError.code === 'ENOENT') continue;
        // Malformed lock: remove it once, then retry exclusive creation.
        logger.warn(`Removing invalid process lock: ${readError.message}`);
        await fs.unlink(LOCKFILE).catch(()=>{});
      }
    }
  }
  throw new Error('Unable to acquire process lock');
}
async function releaseLock() {
  if (!lockAcquired) return;
  try { await fs.unlink(LOCKFILE); lockAcquired = false; } catch {}
}

// ------------------------------------------------------------
// CLIENT
// ------------------------------------------------------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel, Partials.GuildMember, Partials.Message],
  presence: { status: 'online', activities: [{ name: 'Minecraft PvP • /setup', type: 0 }] },
  failIfNotExists: false
});

// Health diagnostics
let heartbeatInterval = null;
let reconnectAttempts = 0;
let lastReadyAt = null;

function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(()=> {
    const uptime = process.uptime();
    logger.health(`Heartbeat — uptime ${Math.floor(uptime)}s, guilds ${client.guilds.cache.size}, ws ping ${client.ws.ping}ms, readyAt ${lastReadyAt}`);
    // Update lock timestamp
    fs.writeFile(LOCKFILE, JSON.stringify({ pid: process.pid, ts: Date.now() })).catch(()=>{});
  }, 60_000);
  // Unref so it doesn't block exit
  if (heartbeatInterval.unref) heartbeatInterval.unref();
}

// Retry helper with exponential backoff + jitter
async function retry(fn, { retries=3, baseMs=500, context='operation' }={}) {
  let lastErr;
  for (let i=0;i<=retries;i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const isRetryable = e.code === 500 || e.code === 429 || e.status === 429 || /fetch failed|ECONN|ENOTFOUND|EAI_AGAIN|network|socket|TLS|timed? ?out/i.test(e.message || '') || e.name === 'AbortError';
      if (i===retries || !isRetryable) throw e;
      const delay = baseMs * Math.pow(2,i) + Math.random()*200;
      logger.warn(`${context} failed (attempt ${i+1}/${retries+1}), retrying in ${Math.round(delay)}ms: ${e.message}`);
      await new Promise(r=>setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ------------------------------------------------------------
// COMMAND DEFINITIONS
// ------------------------------------------------------------
const commands = registeredCommands;

async function registerCommands() {
  const rest = new REST({ version:'10' }).setToken(process.env.DISCORD_TOKEN);
  logger.boot('Registering slash commands...');
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
  logger.boot(`Registered ${commands.length} slash commands`);
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
const APP_EMOJIS = { sword:'tt_sword', axe:'tt_axe', mace:'tt_mace', uhc:'tt_heart', pot:'tt_pot', nethpot:'tt_fire', smp:'tt_shield', crystal:'tt_crystal', bedrock:'tt_bedrock', combo:'tt_combo', tier:'tt_tier', tester:'tt_tester', player:'tt_player', note:'tt_note', stats:'tt_stats' };
function appEmoji(key, fallback) {
  const name = APP_EMOJIS[key];
  if (!name || !client.application?.emojis?.cache) return fallback;
  const emoji = client.application.emojis.cache.find(e=>e.name===name);
  return emoji ? emoji.toString() : fallback;
}
function modeEmoji(mode) {
  const keys = { Sword:'sword', Axe:'axe', Mace:'mace', UHC:'uhc', Pot:'pot', NethPot:'nethpot', SMP:'smp', Crystal:'crystal', Bedrock:'bedrock', Combo:'combo' };
  return appEmoji(keys[mode], MODE_ICONS[mode]||'🎮');
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

async function assignTier(guild, member, mode, tier, cfg, dbRef) {
  const roleId = cfg.roles?.[mode]?.[tier];
  const role = roleId ? guild.roles.cache.get(roleId) : null;
  if (!role) throw new Error(`Tier role missing for ${mode} ${tier}. Run /setup.`);
  // Remove previous tier roles for same mode
  for (const oldTier of TIERS) {
    const oldId = cfg.roles?.[mode]?.[oldTier];
    if (oldId && member.roles.cache.has(oldId) && oldId !== roleId) {
      await member.roles.remove(oldId, 'TierTestBot tier update').catch(e=>{
        logger.warn(`Failed to remove role ${oldTier} from ${member.user.tag}: ${e.message}`);
        // Check hierarchy
        if (e.code === 50013) throw new Error(`Missing permissions to manage roles. Ensure bot role is above **${roleName(mode, oldTier)}**`);
      });
    }
  }
  await member.roles.add(role, 'TierTestBot tier result').catch(e=>{
    if (e.code === 50013) throw new Error(`Missing permissions: bot role must be higher than **${roleName(mode, tier)}**`);
    throw e;
  });
}

// ------------------------------------------------------------
// EVENTS: READY
// ------------------------------------------------------------
client.once('ready', async () => {
  lastReadyAt = new Date().toISOString();
  logger.boot(`Logged in as ${client.user.tag} (${client.user.id})`);
  logger.boot(`Connected to ${client.guilds.cache.size} guilds`);
  try { await retry(registerCommands, { retries:4, baseMs:1000, context:'slash command registration' }); logger.boot('Slash commands registered.'); } catch (e) { logger.error('Command registration failed after retries: '+(e?.stack||e.message)); }
  startHeartbeat();
  // Verify DB access
  const ok = await verifyAccess();
  logger.boot(`Database verified: ${ok ? 'OK' : 'FAILED'}`);
  // Post readiness confirmation
  console.log(`[READY] TierTestBot V8.0 online. 24/7 monitoring active. Heartbeat every 60s.`);
});

// Handle reconnections
client.on('shardReady', id => logger.info(`Shard ${id} ready`));
client.on('shardReconnecting', id => {
  reconnectAttempts++;
  logger.warn(`Shard ${id} reconnecting (attempt ${reconnectAttempts})`);
});
client.on('shardResume', (id, replayed) => logger.info(`Shard ${id} resumed, replayed ${replayed} events`));
client.on('shardDisconnect', (e, id) => logger.warn(`Shard ${id} disconnected: ${e.code} ${e.reason||''}`));
client.on('shardError', e => logger.error(`Shard error: ${e.message}`));

// ------------------------------------------------------------
// MESSAGE CREATE: prefix -help
// ------------------------------------------------------------
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;
  const content = message.content.trim().toLowerCase();
  if (!content.startsWith('-help') && !content.startsWith('!help')) return;
  const embed = new EmbedBuilder()
    .setTitle('⚔️ ᴛɪᴇʀᴛᴇsᴛʙᴏᴛ • ʜᴇʟᴘ — v8.0')
    .setDescription('**Minecraft PvP Tier Testing** • Premium tier system with private tickets')
    .setColor('#7c3aed')
    .addFields(
      { name: '🎮 sʟᴀsʜ ᴄᴏᴍᴍᴀɴᴅs', value: '`/setup` • Setup roles/channels\n`/register gamertag:<name>` • Register Minecraft account\n`/test` • Assign a tier (quick)\n`/tier` • Official premium card + role\n`/profile member:@player` • View profile\n`/history member:@player` • View tier history\n`/leaderboard [mode]` • View rankings\n`/modes` • List gamemodes\n`/queue` • Manage testing queue' },
      { name: '🎫 ᴛɪᴄᴋᴇᴛs & ǫᴜᴇᴜᴇ', value: 'Open a private ticket via **🎫 Select Menu** in <#'+( (await readDB())[message.guild.id]?.channels?.join || 'tier-queue')+'>\n• Private per-gamemode\n• Mode-specific tester access\n• Claim / Close / Reopen controls' },
      { name: '🧪 ᴛᴇsᴛᴇʀ ʀᴏʟᴇs', value: MODES.map(m=> `${MODE_ICONS[m]} ${aestheticMode(m)} Tester`).join(' • ') },
      { name: '💎 ɴᴏᴛᴇs', value: 'All commands are slash commands. This `-help` is prefix-only for convenience. Bot never changes your global username.' }
    )
    .setFooter({ text: 'TierTestBot V8.0 • Made by Khargosh with ❤️' })
    .setTimestamp();
  await message.reply({ embeds:[embed] }).catch(()=>{});
});

// ------------------------------------------------------------
// INTERACTION HANDLER
// ------------------------------------------------------------
client.on('interactionCreate', async interaction => {
  if (!interaction.guild) return;

  // Handle autocomplete? none
  try {
    // SLASH COMMANDS
    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === 'setup') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content:'❌ You need **Manage Server** permission to run /setup.', ephemeral:true });
        }
        await interaction.deferReply({ ephemeral:true });
        // Check bot permissions
        const me = interaction.guild.members.me;
        const needed = [PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels];
        const missing = needed.filter(p=> !me.permissions.has(p));
        if (missing.length) {
          await interaction.editReply(`⚠️ Bot missing permissions: **Manage Roles, Manage Channels**\n\nGrant **Manage Roles** and **Manage Channels**, and move bot role above tier roles in **Server Settings → Roles**.`);
          return;
        }
        const db = await readDB();
        const cfg = await setupGuild(interaction.guild, db, client);
        await writeDB(db);
        await interaction.editReply(
          `✅ **Tier testing setup complete!**\n\n`+
          `Created/verified **${MODES.length*TIERS.length} tier roles** across ${MODES.length} gamemodes.\n`+
          `Example: **ᴀxᴇ • ʟᴛ³** and **Sword Tester**, **Axe Tester**, etc.\n`+
          `Registered role: ${cfg.registeredRole ? `<@&${cfg.registeredRole}>` : '`Registered` (created)'}\n`+
          `📋 Results channel: <#${cfg.resultsChannel}>\n`+
          `🎫 Tickets category: <#${cfg.categories?.tickets}>\n`+
          `🗂️ Created the full tier-testing channel layout.\n`+
          `Use **/register** to link Minecraft, **/test** for quick assign, **/tier** for premium card.`
        );
        return;
      }

      if (interaction.commandName === 'register') {
        const rawTag = interaction.options.getString('gamertag');
        const v = validateGamertag(rawTag);
        if (!v.valid) return interaction.reply({ content:`❌ Invalid gamertag: ${v.reason}`, ephemeral:true });

        const gamertag = v.value;
        const db = await readDB();
        const cfg = db[interaction.guild.id];
        if (!cfg) return interaction.reply({ content:'⚠️ Run **/setup** first.', ephemeral:true });

        // Prevent duplicate? Allow update
        const existing = cfg.registrations?.[interaction.user.id];
        const isUpdate = Boolean(existing);

        await withDB(async db2=>{
          db2[interaction.guild.id] ??= { registrations:{} };
          db2[interaction.guild.id].registrations ??= {};
          db2[interaction.guild.id].registrations[interaction.user.id] = { gamertag, registeredAt: new Date().toISOString(), guildId: interaction.guild.id };
        });

        // Assign Registered role if exists
        let roleMsg = '';
        if (cfg.registeredRole) {
          const role = interaction.guild.roles.cache.get(cfg.registeredRole);
          if (role) {
            try { await interaction.member.roles.add(role, 'TierTestBot registration'); roleMsg = `\n✅ Assigned <@&${role.id}>`; }
            catch (e) { roleMsg = `\n⚠️ Could not assign Registered role: ${e.message}`; }
          }
        } else {
          roleMsg = `\nℹ️ No **Registered** role found. Admin: run **/setup** to create it.`;
        }

        // Set nickname
        let nickMsg = '';
        try {
          if (interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageNicknames)) {
            // Check hierarchy: bot must be higher than target
            if (interaction.member.manageable) {
              await interaction.member.setNickname(gamertag, 'TierTestBot registration');
              nickMsg = `\n✅ Nickname set to **${gamertag}**`;
            } else {
              nickMsg = `\n⚠️ Cannot change nickname: your role is higher than bot's role or you are server owner.`;
            }
          } else {
            nickMsg = `\n⚠️ Bot lacks **Manage Nicknames** permission to set nickname.`;
          }
        } catch (e) {
          nickMsg = `\n⚠️ Nickname not changed: ${e.message}`;
        }

        const embed = new EmbedBuilder()
          .setColor('#22c55e')
          .setTitle(isUpdate ? '✅ Gamertag Updated' : '✅ Registered')
          .setDescription(`${interaction.user} registered Minecraft gamertag **\`${gamertag}\`**${roleMsg}${nickMsg}\n\n> View with **/profile** • Bot never changes global username, only server nickname.`)
          .setFooter({ text: 'TierTestBot • Registration' })
          .setTimestamp();

        return interaction.reply({ embeds:[embed], ephemeral:false });
      }

      if (interaction.commandName === 'modes') {
        const embed = new EmbedBuilder()
          .setTitle('🎮 Minecraft Testing Modes')
          .setDescription(MODES.map(m=> `${modeEmoji(m)} **${m}** — ${aestheticMode(m)} • ${aestheticTier('HT1')} → ${aestheticTier('LT5')}`).join('\n'))
          .setColor('#0ea5e9')
          .setFooter({ text: 'TierTestBot • 10 gamemodes' });
        return interaction.reply({ embeds:[embed], ephemeral:true });
      }

      // Ensure guild config exists for other commands
      const db = await readDB();
      const cfg = db[interaction.guild.id];
      if (!cfg && !['setup','register','modes'].includes(interaction.commandName)) {
        return interaction.reply({ content:'⚠️ Run **/setup** first to initialize this server.', ephemeral:true });
      }

      if (interaction.commandName === 'test') {
        const player = interaction.options.getUser('player');
        const mode = interaction.options.getString('mode');
        const tier = interaction.options.getString('tier');

        const mv = validateMode(mode), tv = validateTier(tier);
        if (!mv.valid) return interaction.reply({ content: mv.reason, ephemeral:true });
        if (!tv.valid) return interaction.reply({ content: tv.reason, ephemeral:true });
        if (!isTesterForMode(interaction.member, cfg, mode)) return interaction.reply({ content:`❌ You need **${mode} Tester** or administrator permissions to assign this mode.`, ephemeral:true });

        const member = await interaction.guild.members.fetch(player.id).catch(()=>null);
        if (!member) return interaction.reply({ content:'❌ Player not found in this server.', ephemeral:true });

        const roleId = cfg.roles?.[mode]?.[tier];
        const role = roleId ? interaction.guild.roles.cache.get(roleId) : null;
        if (!role) return interaction.reply({ content:'❌ That tier role is missing. Run /setup again.', ephemeral:true });

        const previousTier = await getPreviousTier(cfg, member, mode);

        try {
          await assignTier(interaction.guild, member, mode, tier, cfg, db);
        } catch (e) {
          return interaction.reply({ content:`❌ Role assignment failed: ${e.message}`, ephemeral:true });
        }

        // Persist
        await withDB(async db2=>{
          db2[interaction.guild.id] ??= {};
          db2[interaction.guild.id].results ??= {};
          db2[interaction.guild.id].results[player.id] ??= {};
          db2[interaction.guild.id].results[player.id][mode] = { tier, tester: interaction.user.id, updatedAt: new Date().toISOString() };
          db2[interaction.guild.id].history ??= {};
          db2[interaction.guild.id].history[player.id] ??= [];
          db2[interaction.guild.id].history[player.id].push({ mode, from: previousTier, to: tier, tester: interaction.user.id, at: new Date().toISOString(), via: 'test' });
          // Keep last 50
          if (db2[interaction.guild.id].history[player.id].length>50) db2[interaction.guild.id].history[player.id].shift();
        });
        await addHistory(interaction.guild.id, player.id, mode, previousTier, tier, interaction.user.id, 'via /test').catch(()=>{});

        const embed = new EmbedBuilder()
          .setColor(tierAccent(tier))
          .setAuthor({ name: `${appEmoji('tier','⚔️')} TierTestBot • Tier Result`, iconURL: client.user.displayAvatarURL() })
          .setTitle(`${modeEmoji(mode)} ${aestheticMode(mode)} • ${aestheticTier(tier)}`)
          .setThumbnail(player.displayAvatarURL({ size:256 }))
          .setDescription(`${appEmoji('player','👤')} **Player** ${player}`)
          .addFields(
            { name: `${appEmoji('tier','🏆')} Rank Earned`, value: `**${aestheticTier(tier)}**`, inline:true },
            { name: '📈 Previous', value: previousTier ? `**${aestheticTier(previousTier)}**` : '`NOT TESTED`', inline:true },
            { name: `${appEmoji('tester','🧪')} Tested By`, value: `${interaction.user}`, inline:true }
          )
          .setFooter({ text: 'TierTestBot • Minecraft PvP Rankings' })
          .setTimestamp();

        await interaction.reply({ embeds:[embed] });
        const channel = cfg.resultsChannel ? interaction.guild.channels.cache.get(cfg.resultsChannel) : null;
        if (channel && channel.id !== interaction.channelId) await channel.send({ embeds:[embed] }).catch(()=>{});
        return;
      }

      if (interaction.commandName === 'tier') {
        const player = interaction.options.getUser('player');
        const gamertagRaw = interaction.options.getString('gamertag');
        const tier = interaction.options.getString('rank');
        const mode = interaction.options.getString('gm');
        const noteRaw = interaction.options.getString('note') || 'ggs';
        const regionRaw = interaction.options.getString('region') || 'AS';
        const deviceRaw = interaction.options.getString('device') || 'Mobile';
        const selectedTester = interaction.options.getUser('tester') || interaction.user;

        const gv = validateGamertag(gamertagRaw);
        if (!gv.valid) return interaction.reply({ content:`❌ Invalid gamertag: ${gv.reason}`, ephemeral:true });
        const gamertag = gv.value;
        const note = sanitizeNote(noteRaw);
        const region = validateRegion(regionRaw);
        const device = validateDevice(deviceRaw);

        const mv = validateMode(mode), tv = validateTier(tier);
        if (!mv.valid) return interaction.reply({ content: mv.reason, ephemeral:true });
        if (!tv.valid) return interaction.reply({ content: tv.reason, ephemeral:true });
        if (!isTesterForMode(interaction.member, cfg, mode)) return interaction.reply({ content:`❌ You need **${mode} Tester** or administrator permissions to publish this mode.`, ephemeral:true });
        const selectedTesterMember = await interaction.guild.members.fetch(selectedTester.id).catch(()=>null);
        if (!selectedTesterMember || !isTesterForMode(selectedTesterMember, cfg, mode)) return interaction.reply({ content:`❌ Selected tester must have **${mode} Tester** role or administrator permissions.`, ephemeral:true });

        const member = await interaction.guild.members.fetch(player.id).catch(()=>null);
        if (!member) return interaction.reply({ content:'❌ Player not found.', ephemeral:true });

        const roleId = cfg.roles?.[mode]?.[tier];
        const role = roleId ? interaction.guild.roles.cache.get(roleId) : null;
        if (!role) return interaction.reply({ content:'❌ That tier role is missing. Run /setup again.', ephemeral:true });

        const previousTier = await getPreviousTier(cfg, member, mode);
        try { await assignTier(interaction.guild, member, mode, tier, cfg, db); }
        catch (e) { return interaction.reply({ content:`❌ Role assignment failed: ${e.message}`, ephemeral:true }); }

        await withDB(async db2=>{
          db2[interaction.guild.id] ??= {};
          db2[interaction.guild.id].results ??= {};
          db2[interaction.guild.id].results[player.id] ??= {};
          db2[interaction.guild.id].results[player.id][mode] = { tier, gamertag, note, region, device, tester: selectedTester.id, updatedAt: new Date().toISOString() };
          db2[interaction.guild.id].history ??= {};
          db2[interaction.guild.id].history[player.id] ??= [];
          db2[interaction.guild.id].history[player.id].push({ mode, from: previousTier, to: tier, gamertag, note, region, device, tester: selectedTester.id, at: new Date().toISOString(), via: 'tier' });
          if (db2[interaction.guild.id].history[player.id].length>50) db2[interaction.guild.id].history[player.id].shift();
        });
        await addHistory(interaction.guild.id, player.id, mode, previousTier, tier, selectedTester.id, note).catch(()=>{});

        await interaction.deferReply();

        let image;
        try {
          image = await buildTierCard({ player, gamertag, mode, tier, tester: selectedTester, previousTier, note, region, device, serverName: interaction.guild.name, date: new Date() });
        } catch (e) {
          logger.warn(`Card generation failed: ${e.message}`);
          image = null;
        }

        if (image) {
          const cardFile = `tier-${player.id}-${mode.toLowerCase()}.${image.ext}`;
          const attachment = new AttachmentBuilder(image.buffer, { name: cardFile });
          const embed = new EmbedBuilder()
            .setColor(tierAccent(tier))
            .setAuthor({ name: `${appEmoji('tier','⚔️')} TierTestBot • Tier Update`, iconURL: client.user.displayAvatarURL() })
            .setTitle(`${modeEmoji(mode)} ${aestheticMode(mode)} • ${aestheticTier(tier)}`)
            .setThumbnail(player.displayAvatarURL({ size:512, extension:'png' }))
            .setDescription(`${appEmoji('player','👤')} ${player} • \`${gamertag}\``)
            .addFields(
              { name: '🏆 Rank Earned', value: `**${aestheticTier(tier)}**`, inline:true },
              { name: '📈 Previous', value: previousTier ? `**${aestheticTier(previousTier)}**` : '`UNRANKED`', inline:true },
              { name: `${appEmoji('tester','🧪')} Tester`, value: `${selectedTester}`, inline:true },
              { name: '🌍 Region', value: region, inline:true },
              { name: '📱 Device', value: device, inline:true },
              { name: `${appEmoji('note','📝')} Note`, value: note, inline:false }
            )
            .setImage(`attachment://${cardFile}`)
            .setFooter({ text: 'Made by Khargosh with ❤️ • TierTestBot' })
            .setTimestamp();
          await interaction.editReply({ embeds:[embed], files:[attachment] });
          const channel = cfg.resultsChannel ? interaction.guild.channels.cache.get(cfg.resultsChannel) : null;
          if (channel && channel.id !== interaction.channelId) await channel.send({ embeds:[embed], files:[attachment] }).catch(()=>{});
          if (['HT1','LT1','HT2','LT2'].includes(tier) && cfg.highResultsChannel) {
            const high = interaction.guild.channels.cache.get(cfg.highResultsChannel);
            if (high && high.id !== interaction.channelId) await high.send({ embeds:[embed], files:[attachment] }).catch(()=>{});
          }
        } else {
          // Fallback embed without image
          const embed = new EmbedBuilder()
            .setColor(tierAccent(tier))
            .setTitle(`${modeEmoji(mode)} ${aestheticMode(mode)} • ${aestheticTier(tier)}`)
            .setDescription(`**${gamertag}** achieved **${aestheticTier(tier)}** in **${mode}**\nPrevious: ${previousTier? aestheticTier(previousTier):'UNRANKED'}\nTester: ${selectedTester}\nRegion: ${region} | Device: ${device}\nNote: ${note}\n\n> Card generation unavailable, showing embed fallback.`)
            .setFooter({ text: 'Made by Khargosh with ❤️' })
            .setTimestamp();
          await interaction.editReply({ embeds:[embed] });
        }
        return;
      }

      if (interaction.commandName === 'profile') {
        const player = interaction.options.getUser('member');
        const results = cfg.results?.[player.id] || {};
        const registration = cfg.registrations?.[player.id];
        const testedCount = MODES.filter(m=> results[m]).length;
        const last = Object.values(results).sort((a,b)=> new Date(b.updatedAt)-new Date(a.updatedAt))[0];
        const lastDate = last?.updatedAt ? `<t:${Math.floor(new Date(last.updatedAt).getTime()/1000)}:R>` : '`Never`';
        const gamertag = registration?.gamertag || Object.values(results).find(r=> r.gamertag)?.gamertag || 'Not set';

        const modeFields = MODES.map(mode=>{
          const result = results[mode];
          if (!result) return { name: `${modeEmoji(mode)} ${aestheticMode(mode)}`, value:'`NOT TESTED`', inline:true };
          return { name: `${modeEmoji(mode)} ${aestheticMode(mode)}`, value:`**${aestheticTier(result.tier)}**\n${appEmoji('tester','🧪')} ${result.tester ? `<@${result.tester}>` : '`Unknown`'}`, inline:true };
        });

        const embed = new EmbedBuilder()
          .setColor('#7c3aed')
          .setAuthor({ name: `${appEmoji('tier','⚔️')} TierTestBot • Player Profile`, iconURL: client.user.displayAvatarURL() })
          .setTitle(`${player.username}'s Tier Profile`)
          .setThumbnail(player.displayAvatarURL({ size:512, extension:'png' }))
          .setDescription(`${appEmoji('player','👤')} **Discord:** ${player}\n🎮 **Minecraft:** \`${gamertag}\` ${registration ? '✅ Registered' : '⚠️ Not registered (use /register)'}\n\n${appEmoji('stats','📊')} **${testedCount}/${MODES.length}** gamemodes tested`)
          .addFields(modeFields)
          .addFields({ name:'📌 Profile Stats', value:`**Tests:** ${testedCount}/${MODES.length}\n**Last Tested:** ${lastDate}\n**Registration:** ${registration ? `Registered <t:${Math.floor(new Date(registration.registeredAt).getTime()/1000)}:R>` : 'Not registered'}`, inline:false })
          .setFooter({ text: 'TierTestBot • /profile • Made by Khargosh with ❤️' })
          .setTimestamp();
        return interaction.reply({ embeds:[embed] });
      }

      if (interaction.commandName === 'history') {
        const player = interaction.options.getUser('member');
        const modeFilter = interaction.options.getString('mode');
        const history = cfg.history?.[player.id] || [];
        let filtered = history;
        if (modeFilter) filtered = history.filter(h=> h.mode===modeFilter);
        filtered = filtered.slice(-15).reverse(); // most recent first
        if (!filtered.length) return interaction.reply({ content: `No history for ${player} ${modeFilter? `in **${modeFilter}**`:''}.`, ephemeral:true });
        const lines = filtered.map((h,i)=> {
          const date = h.at ? `<t:${Math.floor(new Date(h.at).getTime()/1000)}:d>` : '—';
          return `**${i+1}.** ${modeEmoji(h.mode)} **${h.mode}** • ${h.from? aestheticTier(h.from):'UNRANKED'} → **${aestheticTier(h.to)}** ${h.tester ? `by <@${h.tester}>` : ''} ${date} ${h.note? `• *${String(h.note).slice(0,40)}*`:''}`;
        });
        const embed = new EmbedBuilder()
          .setTitle(`📜 ${player.username}'s History ${modeFilter? `— ${modeFilter}`:''}`)
          .setDescription(lines.join('\n'))
          .setColor('#6366f1')
          .setFooter({ text: 'TierTestBot • History' })
          .setTimestamp();
        return interaction.reply({ embeds:[embed], ephemeral:false });
      }

      if (interaction.commandName === 'leaderboard') {
        const mode = interaction.options.getString('mode');
        const entries = [];
        for (const [userId, results] of Object.entries(cfg.results ?? {})) {
          if (mode) { if (results[mode]) entries.push({ userId, tier: results[mode].tier }); }
          else { const best = Object.entries(results).sort((a,b)=> tierOrder(a[1].tier)-tierOrder(b[1].tier))[0]; if (best) entries.push({ userId, mode: best[0], tier: best[1].tier }); }
        }
        entries.sort((a,b)=> tierOrder(a.tier)-tierOrder(b.tier));
        const shown = entries.slice(0,15).map((e,i)=> `${i+1}. <@${e.userId}> — **${aestheticTier(e.tier)} ${e.tier}**${e.mode? ` (${e.mode})`:''}`);
        const embed = new EmbedBuilder()
          .setTitle(`🏆 ${mode? `${mode} `:''}Tier Leaderboard`)
          .setDescription(shown.length? shown.join('\n') : 'No tier results yet.')
          .setColor('#f59e0b')
          .setFooter({ text: 'TierTestBot • Leaderboard' })
          .setTimestamp();
        return interaction.reply({ embeds:[embed] });
      }

      if (interaction.commandName === 'queue') {
        const action = interaction.options.getString('action') || 'view';
        const dbLive = await readDB();
        const c = dbLive[interaction.guild.id];
        c.queue ??= [];
        if (action==='join') {
          if (!c.queue.includes(interaction.user.id)) c.queue.push(interaction.user.id);
          await writeDB(dbLive);
          return interaction.reply({ content:`⏳ You are **#${c.queue.indexOf(interaction.user.id)+1}** in the testing queue.`, ephemeral:true });
        }
        if (action==='leave') {
          c.queue = c.queue.filter(id=> id!==interaction.user.id); await writeDB(dbLive);
          return interaction.reply({ content:'✅ You have left the testing queue.', ephemeral:true });
        }
        const text = c.queue.length ? c.queue.slice(0,20).map((id,i)=> `**${i+1}.** <@${id}>`).join('\n') : 'Queue is currently empty.';
        return interaction.reply({ embeds:[new EmbedBuilder().setColor('#f59e0b').setTitle('⏳・ᴛᴇsᴛɪɴɢ ǫᴜᴇᴜᴇ').setDescription(text)], ephemeral:true });
      }
    }

    // BUTTON HANDLERS
    if (interaction.isButton()) {
      if (interaction.customId === 'tt_apply') {
        const modal = new ModalBuilder().setCustomId('tt_apply_modal').setTitle('Tier Test Application');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('gamertag').setLabel('Minecraft Gamertag').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(16)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('mode').setLabel('Gamemode').setPlaceholder('Sword / Axe / Crystal...').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('note').setLabel('Note (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(200))
        );
        return interaction.showModal(modal);
      }

      // Queue buttons (legacy)
      const db2 = await readDB(), cfg2 = db2[interaction.guild.id];
      if (!cfg2) return interaction.reply({ content:'⚠️ Run `/setup` first.', ephemeral:true });
      cfg2.queue ??= [];

      if (interaction.customId === 'tt_queue_join' || interaction.customId.startsWith('tt_joinq_')) {
        if (interaction.customId.startsWith('tt_joinq_')) {
          const ticketId = interaction.customId.replace('tt_joinq_','');
          const ticket = cfg2.tickets?.[ticketId];
          if (!ticket || ticket.status === 'closed') return interaction.reply({ content:'❌ Ticket is no longer active.', ephemeral:true });
          cfg2.queues ??= {}; cfg2.queues[ticket.mode] ??= [];
          if (!cfg2.queues[ticket.mode].includes(interaction.user.id)) cfg2.queues[ticket.mode].push(interaction.user.id);
          await writeDB(db2);
          return interaction.reply({ content:`⏳ You are **#${cfg2.queues[ticket.mode].indexOf(interaction.user.id)+1}** in the **${ticket.mode}** queue.`, ephemeral:true });
        }
        if (!cfg2.queue.includes(interaction.user.id)) cfg2.queue.push(interaction.user.id);
        await writeDB(db2);
        const pos = cfg2.queue.indexOf(interaction.user.id)+1;
        return interaction.reply({ content:`⏳ You are **#${pos}** in the testing queue.`, ephemeral:true });
      }
      if (interaction.customId === 'tt_queue_leave' || interaction.customId.startsWith('tt_leaveq_')) {
        if (interaction.customId.startsWith('tt_leaveq_')) {
          const ticketId = interaction.customId.replace('tt_leaveq_','');
          const ticket = cfg2.tickets?.[ticketId];
          if (!ticket) return interaction.reply({ content:'❌ Ticket not found.', ephemeral:true });
          cfg2.queues ??= {}; cfg2.queues[ticket.mode] ??= [];
          cfg2.queues[ticket.mode] = cfg2.queues[ticket.mode].filter(id=>id!==interaction.user.id);
          await writeDB(db2);
          return interaction.reply({ content:`✅ You left the **${ticket.mode}** queue.`, ephemeral:true });
        }
        cfg2.queue = cfg2.queue.filter(id=> id!==interaction.user.id); await writeDB(db2);
        return interaction.reply({ content:'✅ You have left the testing queue.', ephemeral:true });
      }
      if (interaction.customId === 'tt_queue_view' || interaction.customId.startsWith('tt_viewqueue_')) {
        let queue = cfg2.queue; let modeLabel = '';
        if (interaction.customId.startsWith('tt_viewqueue_')) {
          const ticketId = interaction.customId.replace('tt_viewqueue_','');
          const ticket = cfg2.tickets?.[ticketId];
          if (!ticket) return interaction.reply({ content:'❌ Ticket not found.', ephemeral:true });
          queue = cfg2.queues?.[ticket.mode] || []; modeLabel = ` • ${ticket.mode}`;
        }
        const text = queue.length ? queue.slice(0,20).map((id,i)=> `**${i+1}.** <@${id}>`).join('\n') : 'Queue is currently empty.';
        return interaction.reply({ embeds:[new EmbedBuilder().setColor('#f59e0b').setTitle(`⏳・ᴛᴇsᴛɪɴɢ ǫᴜᴇᴜᴇ${modeLabel}`).setDescription(text)], ephemeral:true });
      }
      if (interaction.customId === 'tt_leaderboard') {
        const rows=[]; for(const [uid,res] of Object.entries(cfg2.results||{})) for(const mode of MODES) if(res[mode]) rows.push({uid,tier:res[mode].tier,mode});
        rows.sort((a,b)=> tierOrder(a.tier)-tierOrder(b.tier));
        const text=rows.slice(0,20).map((r,i)=> `**${i+1}.** <@${r.uid}> — **${aestheticTier(r.tier)}** • ${aestheticMode(r.mode)}`).join('\n') || 'No results yet.';
        return interaction.reply({ embeds:[new EmbedBuilder().setColor('#8b5cf6').setTitle('👑・ᴏғғɪᴄɪᴀʟ ʀᴀɴᴋɪɴɢ').setDescription(text)], ephemeral:true });
      }
      if (interaction.customId === 'tt_modes') return interaction.reply({ content: MODES.map(m=> `${modeEmoji(m)} **${aestheticMode(m)}**`).join(' • '), ephemeral:true });

      // Ticket specific buttons
      if (interaction.customId.startsWith('tt_claim_')) {
        try { await handleClaim(interaction, interaction.guild, cfg2); } catch(e){ const msg = e.message.includes('Already claimed')? e.message : `❌ Claim failed: ${e.message}`; if (!interaction.replied) await interaction.reply({ content: msg, ephemeral:true }); else await interaction.followUp({ content: msg, ephemeral:true }); }
        return;
      }
      if (interaction.customId.startsWith('tt_close_')) {
        try { await handleClose(interaction, interaction.guild, cfg2); } catch(e){ logger.error('Close ticket error: '+e.message); if (!interaction.replied) await interaction.reply({ content:`❌ Close failed: ${e.message}`, ephemeral:true }); }
        return;
      }
      if (interaction.customId.startsWith('tt_reopen_')) {
        try { await handleReopen(interaction, interaction.guild, cfg2); } catch(e){ await interaction.reply({ content:`❌ Reopen failed: ${e.message}`, ephemeral:true }); }
        return;
      }
    }

    // STRING SELECT (ticket open)
    if (interaction.isStringSelectMenu() && interaction.customId === 'tt_ticket_open') {
      const mode = interaction.values[0];
      const mv = validateMode(mode);
      if (!mv.valid) return interaction.reply({ content:'❌ Invalid gamemode.', ephemeral:true });
      const dbLive = await readDB();
      const cfgLive = dbLive[interaction.guild.id];
      if (!cfgLive) return interaction.reply({ content:'⚠️ Run **/setup** first.', ephemeral:true });

      // Need gamertag: try registration first, else ask via modal
      let gamertag = cfgLive.registrations?.[interaction.user.id]?.gamertag;
      if (!gamertag) {
        // For quick UX, try to fetch from results
        const anyResult = cfgLive.results?.[interaction.user.id];
        if (anyResult) gamertag = Object.values(anyResult).find(r=> r.gamertag)?.gamertag;
      }
      if (!gamertag) {
        // Prompt modal to collect gamertag
        const modal = new ModalBuilder().setCustomId(`tt_ticket_gamertag_${mode}`).setTitle(`Open ${mode} Ticket`);
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('gamertag').setLabel('Minecraft Gamertag').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(16)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('note').setLabel('Note (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100))
        );
        return interaction.showModal(modal);
      }

      await interaction.deferReply({ ephemeral:true });
      try {
        const ch = await createTicket(interaction.guild, interaction.user, mode, gamertag, cfgLive);
        await interaction.editReply({ content:`✅ Created private **${mode}** ticket: ${ch} — check your private channel.` });
      } catch (e) {
        await interaction.editReply({ content:`❌ ${e.message}` });
      }
      return;
    }

    // MODAL SUBMITS
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'tt_apply_modal') {
        const db2=await readDB(), cfg2=db2[interaction.guild.id]; if(!cfg2) return interaction.reply({content:'⚠️ Run `/setup` first.',ephemeral:true});
        const gamertagRaw = interaction.fields.getTextInputValue('gamertag');
        const modeRaw = interaction.fields.getTextInputValue('mode');
        const noteRaw = interaction.fields.getTextInputValue('note') || 'No note';
        const gv = validateGamertag(gamertagRaw);
        if (!gv.valid) return interaction.reply({ content:`❌ ${gv.reason}`, ephemeral:true });
        let mode = modeRaw.trim();
        // Normalize case-insensitive
        const found = MODES.find(m=> m.toLowerCase()===mode.toLowerCase());
        if (!found) return interaction.reply({ content:`❌ Invalid gamemode. Choose: ${MODES.join(', ')}`, ephemeral:true });
        mode = found;
        const note = sanitizeNote(noteRaw);

        cfg2.applications ??= [];
        const application={id:Date.now().toString(36),userId:interaction.user.id,gamertag:gv.value,mode,note,createdAt:new Date().toISOString()};
        cfg2.applications.push(application); await writeDB(db2);
        const applyChannel=cfg2.channels?.apply? interaction.guild.channels.cache.get(cfg2.channels.apply):null;
        if(applyChannel) await applyChannel.send({embeds:[new EmbedBuilder().setColor('#7c3aed').setTitle('📝・ɴᴇᴡ ᴛɪᴇʀ ᴀᴘᴘʟɪᴄᴀᴛɪᴏɴ').setDescription(`**Applicant:** ${interaction.user}\n**Gamertag:** \`${application.gamertag}\`\n**Mode:** ${application.mode}\n**Note:** ${application.note}`).setTimestamp()]}).catch(()=>{});
        return interaction.reply({content:'✅ **Application submitted!** A tester will review it.',ephemeral:true});
      }

      if (interaction.customId.startsWith('tt_ticket_gamertag_')) {
        const mode = interaction.customId.replace('tt_ticket_gamertag_','');
        const gamertagRaw = interaction.fields.getTextInputValue('gamertag');
        const gv = validateGamertag(gamertagRaw);
        if (!gv.valid) return interaction.reply({ content:`❌ ${gv.reason}`, ephemeral:true });
        const dbLive = await readDB();
        const cfgLive = dbLive[interaction.guild.id];
        try {
          const ch = await createTicket(interaction.guild, interaction.user, mode, gv.value, cfgLive);
          return interaction.reply({ content:`✅ Created private **${mode}** ticket: ${ch}`, ephemeral:true });
        } catch (e) {
          return interaction.reply({ content:`❌ ${e.message}`, ephemeral:true });
        }
      }
    }

  } catch (err) {
    logError('interactionCreate', err);
    const msg = '❌ Something went wrong. Check that the bot has **Manage Roles** and **Manage Channels**, and that its highest role is above the tier roles.';
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply(msg).catch(()=>{});
      else await interaction.reply({ content: msg, ephemeral:true }).catch(()=>{});
    } catch {}
  }
});

// ------------------------------------------------------------
// ERROR HANDLING & RECONNECTION
// ------------------------------------------------------------
client.on('error', error => logger.error('[CLIENT ERROR] '+(error?.stack||error)));
client.rest.on('rateLimited', info => logger.warn(`Rate limited ${info.timeToReset}ms on ${info.route} (global: ${info.global})`));

process.on('unhandledRejection', error => {
  logger.error('[UNHANDLED REJECTION] '+(error?.stack||error));
  // Don't exit for Discord API errors
  if (error?.code === 10062 || error?.code === 40060) return; // unknown interaction / already replied
});
process.on('uncaughtException', error => {
  logger.error('[UNCAUGHT EXCEPTION — fatal] '+(error?.stack||error));
  // Uncaught exceptions can leave state inconsistent; let the process supervisor restart us.
  void releaseLock().finally(()=>process.exit(1));
});

async function gracefulShutdown(signal) {
  logger.boot(`Received ${signal}, shutting down gracefully...`);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  await releaseLock().catch(()=>{});
  try { client.destroy(); } catch {}
  process.exit(0);
}
process.on('SIGINT', ()=> gracefulShutdown('SIGINT'));
process.on('SIGTERM', ()=> gracefulShutdown('SIGTERM'));

// ------------------------------------------------------------
// BOOT SEQUENCE
// ------------------------------------------------------------
async function boot() {
  logger.boot('TierTestBot V8.0 starting...');
  await acquireLock();
  const dbInit = await initDB();
  logger.boot(`Database init: ${dbInit.useSqlite ? 'SQLite (node:sqlite) + JSON blob' : 'JSON fallback'}`);
  const dbOk = await verifyAccess();
  if (!dbOk) {
    logger.error('Database verify failed — check data/ permissions');
    process.exit(1);
  }
  // Load persistent data safely
  const db = await readDB();
  logger.boot(`Loaded persistent data for ${Object.keys(db).length} guild(s)`);
  // Login with retry
  await retry(()=> client.login(process.env.DISCORD_TOKEN), { retries: 5, baseMs: 1000, context: 'Discord login' })
    .then(()=> logger.boot('Discord login initiated.'))
    .catch(error=>{ logger.error('[LOGIN ERROR] '+(error?.stack||error)); process.exit(1); });
}

boot();

// Health-check export for hosting platforms (no HTTP server needed, but log)
setInterval(()=> {
  if (!client.isReady()) {
    logger.warn('Bot not ready, WS status: '+client.ws.status);
    // Attempt reconnect? discord.js auto-reconnects, but log
  }
}, 30_000);
