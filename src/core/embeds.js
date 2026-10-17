/**
 * Panel embeds + button rows for the tier-testing channel layout.
 * Imported by the bot only (it depends on discord.js builders).
 */
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { MODES, MODE_ICONS, aestheticMode } from './config.js';

export function panelEmbed(type) {
  const base = new EmbedBuilder().setTimestamp().setFooter({ text: 'TierTestBot • Official Minecraft PvP Testing' });
  if (type === 'apply') return base.setColor('#7c3aed').setAuthor({ name: '📝 ᴛɪᴇʀᴛᴇsᴛ • ᴀᴘᴘʟɪᴄᴀᴛɪᴏɴ' }).setTitle('✦ ᴛɪᴇʀ ᴛᴇsᴛ ᴀᴘᴘʟʏ').setDescription('Ready to get tested?\n\nClick **Apply Now** and submit your Minecraft gamertag, preferred mode and a short note.\n\n> ✦ Keep your details accurate. A tester will review your application.');
  if (type === 'queue') return base.setColor('#f59e0b').setAuthor({ name: '⏳ ᴛɪᴇʀᴛᴇsᴛ • ǫᴜᴇᴜᴇ' }).setTitle('✦ ᴛᴇsᴛɪɴɢ ǫᴜᴇᴜᴇ').setDescription('Join the testing queue and wait for an available tester.\n\nUse the buttons below to **join** or **leave** the queue.');
  if (type === 'results') return base.setColor('#22c55e').setAuthor({ name: '🏆 ᴛɪᴇʀᴛᴇsᴛ • ʀᴇsᴜʟᴛs' }).setTitle('✦ ᴏғғɪᴄɪᴀʟ ᴛɪᴇʀ ʀᴇsᴜʟᴛs').setDescription('Official tier cards and verified results are posted here automatically by **/tier**.');
  if (type === 'high') return base.setColor('#ef4444').setAuthor({ name: '🔥 ᴛɪᴇʀᴛᴇsᴛ • ʴɪɢʜ ᴛɪᴇʀ' }).setTitle('✦ ʜɪɢʜ ᴛɪᴇʀ ʀᴇsᴜʟᴛs').setDescription('Top-tier results are highlighted here automatically.\n\n**HT1 • LT1 • HT2 • LT2**');
  if (type === 'ranking') return base.setColor('#8b5cf6').setAuthor({ name: '👑 ᴛɪᴇʀᴛᴇsᴛ • ʀᴀɴᴋɪɴɢ' }).setTitle('✦ ᴏғғɪᴄɪᴀʟ ʀᴀɴᴋɪɴɢ').setDescription('Use **View Leaderboard** to see the current server rankings.');
  if (type === 'rules') return base.setColor('#5865f2').setTitle('📜・ᴛɪᴇʀ ʀᴜʟᴇs').setDescription('• Play fair and follow server rules.\n• No cheating, exploits or intentional abuse.\n• Respect testers and other players.\n• Results must be based on the configured testing system.');
  if (type === 'kits') return base.setColor('#14b8a6').setTitle('🧰・ᴛɪᴇʀ ᴋɪᴛs').setDescription('Testing kits and mode-specific preparation information will be listed here.');
  if (type === 'punishment') return base.setColor('#ef4444').setTitle('⚠️・ᴘᴜɴɪsʰᴍᴇɴᴛ').setDescription('Use this channel for documented moderation actions and official punishment information.');
  return base.setColor('#6366f1').setTitle('📚・ᴛɪᴇʀ ᴄᴏɴᴛᴇɴᴛ').setDescription('Official tier-testing guides, clips and educational content.');
}

export function panelRows(type) {
  if (type === 'apply') return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tt_apply').setLabel('Apply Now').setEmoji('📝').setStyle(ButtonStyle.Primary))];
  if (type === 'queue') return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tt_queue_join').setLabel('Join Queue').setEmoji('➕').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('tt_queue_leave').setLabel('Leave Queue').setEmoji('➖').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('tt_queue_view').setLabel('View Queue').setEmoji('👀').setStyle(ButtonStyle.Primary))];
  if (type === 'ranking') return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tt_leaderboard').setLabel('View Leaderboard').setEmoji('👑').setStyle(ButtonStyle.Primary))];
  if (type === 'results') return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tt_modes').setLabel('Testing Modes').setEmoji('🎮').setStyle(ButtonStyle.Secondary))];
  return [];
}

export function modesSummary() {
  return MODES.map(mode => `${MODE_ICONS[mode]} **${aestheticMode(mode)}**`).join(' • ');
}
