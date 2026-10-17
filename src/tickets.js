import { ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { logger } from './logger.js';
import { readDB, writeDB, withDB, claimTicketRecord, createTicketRecord, closeTicketRecord } from './db.js';

const activeCreations = new Set();

export function ticketName(mode, gamertag, user) {
  const clean = gamertag.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,10) || user.username.slice(0,8);
  return `🎫・${mode.toLowerCase()}-${clean}`.slice(0, 32);
}

export function isTesterForMode(member, cfg, mode) {
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  if (member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return true;
  const testerRoleId = cfg.testerRoles?.[mode];
  if (testerRoleId && member.roles.cache.has(testerRoleId)) return true;
  return false;
}

export function hasAnyTesterRole(member, cfg) {
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  if (member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return true;
  for (const mode of Object.keys(cfg.testerRoles||{})) {
    if (member.roles.cache.has(cfg.testerRoles[mode])) return true;
  }
  return false;
}

export async function createTicket(guild, user, mode, gamertag, cfg) {
  const uniqueKey = `${guild.id}:${user.id}:${mode}`;
  if (activeCreations.has(uniqueKey)) throw new Error(`You already have a pending **${mode}** ticket creation. Please wait.`);
  activeCreations.add(uniqueKey);
  try {
  // Validate tester role exists
  const testerRoleId = cfg.testerRoles?.[mode];
  if (!testerRoleId || !guild.roles.cache.get(testerRoleId)) {
    throw new Error(`Tester role for **${mode}** is missing. Run **/setup** first.`);
  }
  // Check duplicate active ticket for same user+mode
  // Look through DB tickets
  const db = await readDB();
  const gcfg = db[guild.id];
  if (gcfg?.tickets) {
    for (const [chId, t] of Object.entries(gcfg.tickets)) {
      if (t.ownerId === user.id && t.mode === mode && ['open','claimed'].includes(t.status)) {
        // Verify channel still exists
        const existingCh = guild.channels.cache.get(chId) || await guild.channels.fetch(chId).catch(()=>null);
        if (existingCh) throw new Error(`You already have an active **${mode}** ticket: <#${chId}>`);
        // Stale entry, mark closed
        t.status = 'closed';
      }
    }
  }

  const categoryId = cfg.categories?.tickets;
  const category = categoryId ? guild.channels.cache.get(categoryId) || await guild.channels.fetch(categoryId).catch(()=>null) : null;
  if (!category) throw new Error('Ticket category missing. Run **/setup**.');

  const chName = ticketName(mode, gamertag, user);

  // Permission overwrites
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles, PermissionsBitField.Flags.EmbedLinks] },
    { id: testerRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles, PermissionsBitField.Flags.EmbedLinks, PermissionsBitField.Flags.ManageMessages] },
    { id: guild.client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageMessages] }
  ];
  // Add admin overwrites implicitly via inheritance? Add explicit for mods with ManageGuild
  // We keep private: only tester role + owner + bot + admins (admins bypass channel perms but we add for safety)
  const adminRoles = guild.roles.cache.filter(r => r.permissions.has(PermissionsBitField.Flags.Administrator) || r.permissions.has(PermissionsBitField.Flags.ManageGuild));
  for (const [, role] of adminRoles) {
    if (role.id === guild.roles.everyone.id) continue;
    if (!overwrites.some(o => o.id === role.id)) {
      overwrites.push({ id: role.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] });
    }
  }

  let channel;
  try {
    channel = await guild.channels.create({
      name: chName,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: overwrites,
      topic: `TierTestBot ticket | ${mode} | ${gamertag} | Owner: ${user.id}`,
      reason: `Private ${mode} ticket for ${user.tag}`
    });
  } catch (e) {
    logger.error(`Ticket create failed: ${e.message}`);
    throw new Error(`Failed to create ticket channel: ${e.message}. Check bot has **Manage Channels** and its role is above tester roles.`);
  }

  // Store ticket
  await withDB(async db2 => {
    db2[guild.id] ??= {};
    db2[guild.id].tickets ??= {};
    db2[guild.id].tickets[channel.id] = {
      ownerId: user.id,
      mode,
      gamertag,
      status: 'open',
      claimedBy: null,
      createdAt: new Date().toISOString(),
      channelId: channel.id
    };
  });

  await createTicketRecord(guild.id, channel.id, user.id, mode).catch(e=>logger.warn(`Ticket normalized-record insert failed: ${e.message}`));

  // Send controls
  const embed = new EmbedBuilder()
    .setColor('#0ea5e9')
    .setAuthor({ name: `🎫 TierTestBot • ${mode} Ticket`, iconURL: guild.client.user.displayAvatarURL() })
    .setTitle(`Private ${mode} Testing Ticket`)
    .setDescription(`Welcome ${user}!\n\n**Gamertag:** \`${gamertag}\`\n**Gamemode:** **${mode}**\n**Status:** 🟢 Open\n\nA **${mode} Tester** will claim your test shortly.\nUse the buttons below to manage your ticket.\n\n> Tickets are private. Only you, ${mode} testers, and admins can view this channel.`)
    .addFields(
      { name: '📌 Instructions', value: '1. Wait for a tester to claim\n2. Coordinate your test time\n3. Tester will run `/tier` after test', inline: false }
    )
    .setFooter({ text: 'TierTestBot • Private Ticket System' })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tt_claim_${channel.id}`).setLabel('Claim Test').setEmoji('🧪').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`tt_close_${channel.id}`).setLabel('Close Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`tt_viewqueue_${channel.id}`).setLabel('View Queue').setEmoji('👀').setStyle(ButtonStyle.Secondary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tt_joinq_${channel.id}`).setLabel('Join Queue').setEmoji('➕').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`tt_leaveq_${channel.id}`).setLabel('Leave Queue').setEmoji('➖').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`tt_reopen_${channel.id}`).setLabel('Reopen').setEmoji('🔓').setStyle(ButtonStyle.Secondary)
  );

  await channel.send({ content: `${user} <@&${testerRoleId}>`, embeds:[embed], components:[row1, row2] });

  return channel;
  } finally {
    activeCreations.delete(uniqueKey);
  }
}

export async function claimTicketState(guildId, channelId, testerId) {
  return withDB(async db2 => {
    const ticket = db2[guildId]?.tickets?.[channelId];
    if (!ticket) throw new Error('Ticket not found');
    if (ticket.status === 'closed') throw new Error('Ticket is closed');
    if (ticket.claimedBy) throw new Error(`Already claimed by ${ticket.claimedBy}`);
    ticket.claimedBy = testerId;
    ticket.status = 'claimed';
    return ticket;
  });
}

export async function handleClaim(interaction, guild, cfg) {
  const channelId = interaction.customId.replace('tt_claim_','');
  const channel = guild.channels.cache.get(channelId) || interaction.channel;
  if (!channel) return interaction.reply({ content:'❌ Ticket channel not found.', ephemeral:true });

  // Check permissions: must be tester for this ticket's mode
  const db = await readDB();
  const ticket = db[guild.id]?.tickets?.[channelId];
  if (!ticket) return interaction.reply({ content:'❌ Ticket not found in DB. It may have been closed.', ephemeral:true });
  if (ticket.claimedBy) return interaction.reply({ content:`⚠️ Already claimed by <@${ticket.claimedBy}>`, ephemeral:true });

  const mode = ticket.mode;
  if (!isTesterForMode(interaction.member, cfg, mode)) {
    return interaction.reply({ content:`❌ You need **${mode} Tester** role to claim this ticket.`, ephemeral:true });
  }

  // Serialized persisted state update prevents simultaneous claims.
  await claimTicketState(guild.id, channelId, interaction.user.id);
  await claimTicketRecord(guild.id, channelId, interaction.user.id).catch(e=>{
    if (e.message.includes('Already claimed')) throw e;
    logger.warn(`Ticket normalized claim failed: ${e.message}`);
  });

  // Notify
  const embed = new EmbedBuilder().setColor('#22c55e').setTitle('🧪 Test Claimed').setDescription(`Tester **${interaction.user}** has claimed this **${mode}** test for <@${ticket.ownerId}>.`)
    .setTimestamp().setFooter({ text: 'TierTestBot • Good luck!' });
  await interaction.reply({ embeds:[embed] });
  // DM or mention owner
  try { await channel.send({ content: `<@${ticket.ownerId}> your test has been claimed by ${interaction.user}! Please coordinate with them.`, embeds:[embed] }); } catch {}
  logger.info(`Ticket ${channelId} claimed by ${interaction.user.tag} for ${mode}`);
}

export async function handleClose(interaction, guild, cfg) {
  const channelId = interaction.customId.replace('tt_close_','');
  const db = await readDB();
  const ticket = db[guild.id]?.tickets?.[channelId];
  if (!ticket) return interaction.reply({ content:'❌ Ticket not found.', ephemeral:true });

  if (ticket.status === 'closed') return interaction.reply({ content:'⚠️ This ticket is already closed.', ephemeral:true });
  const isOwner = interaction.user.id === ticket.ownerId;
  const isTester = isTesterForMode(interaction.member, cfg, ticket.mode);
  if (!isOwner && !isTester) return interaction.reply({ content:'❌ Only the ticket owner or a tester can close this ticket.', ephemeral:true });

  await interaction.deferReply();
  await withDB(async db2=>{
    if (db2[guild.id]?.tickets?.[channelId]) {
      db2[guild.id].tickets[channelId].status = 'closed';
      db2[guild.id].tickets[channelId].closedAt = new Date().toISOString();
    }
  });

  await closeTicketRecord(guild.id, channelId).catch(e=>logger.warn(`Ticket normalized close failed: ${e.message}`));
  const embed = new EmbedBuilder().setColor('#ef4444').setTitle('🔒 Ticket Closed').setDescription(`Ticket closed by ${interaction.user}.\n\nThis channel will be archived.`).setTimestamp();
  await interaction.editReply({ embeds:[embed] });
  try { await interaction.channel.send({ embeds:[embed] }); } catch {}

  // Optionally archive/delete: we keep channel but deny send for non-staff
  // Lock channel: prevent further messages from owner? We'll set permission overwrite to deny SendMessages for owner, keep view.
  try {
    const ch = interaction.channel;
    await ch.permissionOverwrites.edit(ticket.ownerId, { SendMessages: false }).catch(()=>{});
    // Optionally move to archive category or delete after delay if configured
    // For now keep closed state; provide reopen button
  } catch {}
  logger.info(`Ticket ${channelId} closed by ${interaction.user.tag}`);
}

export async function handleReopen(interaction, guild, cfg) {
  const channelId = interaction.customId.replace('tt_reopen_','');
  const db = await readDB();
  const ticket = db[guild.id]?.tickets?.[channelId];
  if (!ticket) return interaction.reply({ content:'❌ Ticket not found.', ephemeral:true });
  const isTester = isTesterForMode(interaction.member, cfg, ticket.mode);
  if (!isTester) return interaction.reply({ content:'❌ Only testers/admins can reopen tickets.', ephemeral:true });

  await withDB(async db2=>{
    if (db2[guild.id]?.tickets?.[channelId]) {
      db2[guild.id].tickets[channelId].status = 'open';
      db2[guild.id].tickets[channelId].closedAt = null;
    }
  });
  try { await interaction.channel.permissionOverwrites.edit(ticket.ownerId, { SendMessages: true }); } catch {}
  const embed = new EmbedBuilder().setColor('#22c55e').setTitle('🔓 Ticket Reopened').setDescription(`Ticket reopened by ${interaction.user}.`).setTimestamp();
  return interaction.reply({ embeds:[embed] });
}
