import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from 'discord.js';
import { getDatabase, getGuildSettings } from '../database/db.js';
import { createBananaEmbed } from '../utils/embeds.js';
import { getGuildEmoji } from '../utils/emojis.js';

export class AnnouncementService {
  /**
   * Broadcasts an automatic update announcement for a newly uploaded or updated script
   */
  static async announceScriptChange(client, guildId, script, isNewRelease = false, changelog = '') {
    const db = getDatabase();
    const config = db.prepare('SELECT * FROM update_announcement_settings WHERE guild_id = ?').get(guildId);

    if (!config || !config.enabled || !config.channel_id) {
      return null;
    }

    // Check if category is filtered
    if (config.categories) {
      try {
        const allowedCats = JSON.parse(config.categories);
        if (Array.isArray(allowedCats) && allowedCats.length > 0) {
          const match = allowedCats.some(c => c.toLowerCase() === (script.category || '').toLowerCase());
          if (!match) return null;
        }
      } catch {
        // ignore
      }
    }

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return null;

      const channel = guild.channels.cache.get(config.channel_id) || await guild.channels.fetch(config.channel_id).catch(() => null);
      if (!channel || !channel.isTextBased()) return null;

      const guildSettings = getGuildSettings(guildId);
      const bananaSparkle = getGuildEmoji(guildSettings, 'bananaSparkle');
      const bananaBox = getGuildEmoji(guildSettings, 'bananaBox');
      const bananaRocket = getGuildEmoji(guildSettings, 'bananaRocket');

      const actionTitle = isNewRelease
        ? `${bananaSparkle} NEW SCRIPT RELEASED: ${script.name} v${script.version}`
        : `${bananaRocket} SCRIPT UPDATED: ${script.name} v${script.version}`;

      const fields = [
        { name: '📁 Category', value: `\`${script.category || 'General'}\``, inline: true },
        { name: '🔖 Version', value: `\`${script.version}\``, inline: true },
        { name: '👤 Author', value: `<@${script.uploader_id}>`, inline: true },
      ];

      if (script.description) {
        fields.push({ name: '📝 Description', value: script.description.slice(0, 1024) });
      }

      if (!isNewRelease && changelog) {
        fields.push({ name: '🛠️ Changelog', value: changelog.slice(0, 1024) });
      }

      const embed = createBananaEmbed(guildSettings, {
        title: actionTitle,
        description: `A script has been ${isNewRelease ? 'added to' : 'updated in'} the **Banana Service** repository!`,
        fields,
        color: isNewRelease ? '#FFE135' : '#F7B731',
      });

      // Optional download button
      const components = [];
      if (config.include_download_button) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`script_dl_${script.id}`)
            .setLabel(`Download ${script.original_filename}`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📥')
        );
        components.push(row);
      }

      let content = undefined;
      if (config.ping_role_id) {
        content = `<@&${config.ping_role_id}>`;
      }

      const msg = await channel.send({ content, embeds: [embed], components });
      return msg;
    } catch (err) {
      console.error('Failed to announce script change:', err);
      return null;
    }
  }

  /**
   * Updates automatic announcement settings for a guild
   */
  static configureAutoUpdates(guildId, { enabled, channelId, pingRoleId, categories, includeDownloadButton }) {
    const db = getDatabase();
    const existing = db.prepare('SELECT guild_id FROM update_announcement_settings WHERE guild_id = ?').get(guildId);

    if (existing) {
      const updates = [];
      const values = [];

      if (enabled !== undefined) { updates.push('enabled = ?'); values.push(enabled ? 1 : 0); }
      if (channelId !== undefined) { updates.push('channel_id = ?'); values.push(channelId); }
      if (pingRoleId !== undefined) { updates.push('ping_role_id = ?'); values.push(pingRoleId); }
      if (categories !== undefined) { updates.push('categories = ?'); values.push(JSON.stringify(categories)); }
      if (includeDownloadButton !== undefined) { updates.push('include_download_button = ?'); values.push(includeDownloadButton ? 1 : 0); }

      if (updates.length > 0) {
        const query = `UPDATE update_announcement_settings SET ${updates.join(', ')} WHERE guild_id = ?`;
        db.prepare(query).run(...values, guildId);
      }
    } else {
      db.prepare(`
        INSERT INTO update_announcement_settings (guild_id, enabled, channel_id, ping_role_id, categories, include_download_button)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        guildId,
        enabled ? 1 : 0,
        channelId,
        pingRoleId || null,
        JSON.stringify(categories || []),
        includeDownloadButton ? 1 : 0
      );
    }

    return db.prepare('SELECT * FROM update_announcement_settings WHERE guild_id = ?').get(guildId);
  }

  static getAutoUpdateConfig(guildId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM update_announcement_settings WHERE guild_id = ?').get(guildId);
  }
}
