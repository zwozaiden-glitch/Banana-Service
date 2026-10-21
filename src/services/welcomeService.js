import { getDatabase, getGuildSettings } from '../database/db.js';
import { createBananaEmbed } from '../utils/embeds.js';
import { getGuildEmoji } from '../utils/emojis.js';

export class WelcomeService {
  static getSettings(guildId) {
    const db = getDatabase();
    let row = db.prepare('SELECT * FROM welcome_settings WHERE guild_id = ?').get(guildId);
    if (!row) {
      db.prepare('INSERT INTO welcome_settings (guild_id) VALUES (?)').run(guildId);
      row = db.prepare('SELECT * FROM welcome_settings WHERE guild_id = ?').get(guildId);
    }
    return row;
  }

  static formatPlaceholders(template, member) {
    if (!template) return '';
    return template
      .replace(/{user}/g, `<@${member.id}>`)
      .replace(/{username}/g, member.user.username)
      .replace(/{server}/g, member.guild.name)
      .replace(/{member_count}/g, String(member.guild.memberCount));
  }

  /**
   * Dispatches welcome message and assigns autoroles
   */
  static async handleMemberJoin(client, member) {
    const guild = member.guild;
    const settings = this.getSettings(guild.id);
    const guildSettings = getGuildSettings(guild.id);

    // 1. Assign autoroles if any configured
    try {
      const db = getDatabase();
      const autoroles = db.prepare('SELECT role_id FROM autoroles WHERE guild_id = ?').all(guild.id);
      for (const ar of autoroles) {
        if (guild.roles.cache.has(ar.role_id)) {
          await member.roles.add(ar.role_id).catch(() => {});
        }
      }
      if (settings.auto_role_id && guild.roles.cache.has(settings.auto_role_id)) {
        await member.roles.add(settings.auto_role_id).catch(() => {});
      }
    } catch (err) {
      console.warn('Failed to assign autorole:', err);
    }

    // 2. Send welcome message if enabled
    if (!settings.is_enabled || !settings.welcome_channel_id) return;

    try {
      const channel = guild.channels.cache.get(settings.welcome_channel_id) || await guild.channels.fetch(settings.welcome_channel_id).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      const title = this.formatPlaceholders(settings.welcome_title, member);
      const desc = this.formatPlaceholders(settings.welcome_message, member);
      const bananaSparkle = getGuildEmoji(guildSettings, 'bananaSparkle');

      const embed = createBananaEmbed(guildSettings, {
        title,
        description: desc,
        thumbnail: member.user.displayAvatarURL({ dynamic: true, size: 256 }),
        color: settings.embed_color || '#FFE135',
        emoji: bananaSparkle,
      });

      await channel.send({ content: `<@${member.id}>`, embeds: [embed] });
    } catch (err) {
      console.error('Failed to send welcome message:', err);
    }
  }

  /**
   * Dispatches goodbye message
   */
  static async handleMemberLeave(client, member) {
    const guild = member.guild;
    const settings = this.getSettings(guild.id);
    const guildSettings = getGuildSettings(guild.id);

    if (!settings.is_enabled || !settings.goodbye_channel_id) return;

    try {
      const channel = guild.channels.cache.get(settings.goodbye_channel_id) || await guild.channels.fetch(settings.goodbye_channel_id).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      const title = this.formatPlaceholders(settings.goodbye_title, member);
      const desc = this.formatPlaceholders(settings.goodbye_message, member);

      const embed = createBananaEmbed(guildSettings, {
        title,
        description: desc,
        thumbnail: member.user?.displayAvatarURL ? member.user.displayAvatarURL({ dynamic: true, size: 256 }) : null,
        color: '#6B7280',
        noEmoji: true,
      });

      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Failed to send goodbye message:', err);
    }
  }
}
