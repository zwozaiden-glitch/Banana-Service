import { getDatabase, getGuildSettings } from '../database/db.js';
import { createBananaEmbed } from './embeds.js';
import { getGuildEmoji } from './emojis.js';

export async function logAuditAction(client, guildId, {
  userId,
  action,
  targetType = null,
  targetId = null,
  details = null,
}) {
  const db = getDatabase();

  try {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (guild_id, user_id, action, target_type, target_id, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(guildId, userId, action, targetType, targetId, typeof details === 'object' ? JSON.stringify(details) : details);
  } catch (err) {
    console.error('Failed to write audit log to database:', err);
  }

  // If modlog channel is configured, send embed notification
  if (!client || !guildId) return;

  try {
    const guildSettings = getGuildSettings(guildId);
    if (!guildSettings?.modlog_channel_id) return;

    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;

    const channel = guild.channels.cache.get(guildSettings.modlog_channel_id) || await guild.channels.fetch(guildSettings.modlog_channel_id).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const auditEmoji = getGuildEmoji(guildSettings, 'bananaShield');
    const embed = createBananaEmbed(guildSettings, {
      title: `Audit Log • ${action}`,
      emoji: auditEmoji,
      fields: [
        { name: 'User', value: `<@${userId}> (${userId})`, inline: true },
        { name: 'Action', value: `\`${action}\``, inline: true },
        ...(targetType ? [{ name: 'Target Type', value: targetType, inline: true }] : []),
        ...(targetId ? [{ name: 'Target ID', value: String(targetId), inline: true }] : []),
        ...(details ? [{ name: 'Details', value: typeof details === 'string' ? details.slice(0, 1024) : JSON.stringify(details).slice(0, 1024) }] : []),
      ],
    });

    await channel.send({ embeds: [embed] }).catch(() => {});
  } catch (err) {
    console.error('Failed to forward audit log to Discord channel:', err);
  }
}
