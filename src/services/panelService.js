import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { getDatabase, getGuildSettings } from '../database/db.js';
import { createBananaEmbed } from '../utils/embeds.js';
import { getGuildEmoji } from '../utils/emojis.js';
import { ScriptService } from './scriptService.js';

export class PanelService {
  /**
   * Builds the main Embed and Components for a Script Hub Panel
   */
  static buildPanelPayload(guildSettings, panelConfig) {
    const totalScripts = ScriptService.listScripts(panelConfig.guild_id, { limit: 1000 }).total;
    const categories = ScriptService.getCategories(panelConfig.guild_id);

    const banana = getGuildEmoji(guildSettings, 'banana');
    const bananaSparkle = getGuildEmoji(guildSettings, 'bananaSparkle');
    const bananaBox = getGuildEmoji(guildSettings, 'bananaBox');

    const defaultDesc = [
      `Welcome to **Banana Service Script Hub**! Here you can find verified scripts, automation tools, and configuration files.`,
      '',
      `📦 **Total Scripts:** \`${totalScripts}\``,
      `📂 **Categories:** \`${categories.length > 0 ? categories.join(', ') : 'General'}\``,
      '',
      `Select an action below to browse, search, download, or inspect versions.`,
    ].join('\n');

    const embed = createBananaEmbed(guildSettings, {
      title: panelConfig.title || '🍌 Banana Service — Script Hub',
      description: panelConfig.description || defaultDesc,
      color: panelConfig.color || guildSettings?.embed_color || '#FFE135',
      image: panelConfig.banner_url || null,
      fields: [
        { name: '📥 Download & Info', value: 'Use the buttons below to browse the catalog or look up a script.', inline: true },
        { name: '⚡ Instant Access', value: 'All scripts are scanned and securely served.', inline: true },
      ],
      footerText: 'Banana Service • Script Delivery Hub',
    });

    // Primary action rows: Browse, Search, Latest Updates
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`panel_browse_${panelConfig.id}`)
        .setLabel('Browse Catalog')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📂'),
      new ButtonBuilder()
        .setCustomId(`panel_search_${panelConfig.id}`)
        .setLabel('Search Script')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔍'),
      new ButtonBuilder()
        .setCustomId(`panel_latest_${panelConfig.id}`)
        .setLabel('Latest Updates')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✨')
    );

    // Secondary action rows: Submit Script, Refresh
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`panel_submit_${panelConfig.id}`)
        .setLabel('Submit Script')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📤'),
      new ButtonBuilder()
        .setCustomId(`panel_refresh_${panelConfig.id}`)
        .setLabel('Refresh')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔄')
    );

    return { embeds: [embed], components: [row1, row2] };
  }

  /**
   * Publishes or creates a new panel in a channel
   */
  static async publishPanel(guild, channel, options = {}) {
    const db = getDatabase();
    const guildSettings = getGuildSettings(guild.id);

    // Create preliminary record
    const insert = db.prepare(`
      INSERT INTO script_panels (guild_id, channel_id, message_id, title, description, color, banner_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Placeholder message id
    const info = insert.run(
      guild.id,
      channel.id,
      'temp_' + Date.now(),
      options.title || '🍌 Banana Service — Script Hub',
      options.description || null,
      options.color || '#FFE135',
      options.bannerUrl || null
    );

    const panelId = info.lastInsertRowid;
    const panelConfig = db.prepare('SELECT * FROM script_panels WHERE id = ?').get(panelId);

    const payload = this.buildPanelPayload(guildSettings, panelConfig);
    const message = await channel.send(payload);

    // Update with real Discord message ID
    db.prepare('UPDATE script_panels SET message_id = ? WHERE id = ?').run(message.id, panelId);

    return db.prepare('SELECT * FROM script_panels WHERE id = ?').get(panelId);
  }

  /**
   * Refreshes an existing panel message
   */
  static async refreshPanel(client, panelId) {
    const db = getDatabase();
    const panel = db.prepare('SELECT * FROM script_panels WHERE id = ?').get(panelId);
    if (!panel) return null;

    try {
      const guild = client.guilds.cache.get(panel.guild_id) || await client.guilds.fetch(panel.guild_id).catch(() => null);
      if (!guild) return null;

      const channel = guild.channels.cache.get(panel.channel_id) || await guild.channels.fetch(panel.channel_id).catch(() => null);
      if (!channel) return null;

      const message = await channel.messages.fetch(panel.message_id).catch(() => null);
      if (!message) {
        // Message was deleted in Discord
        db.prepare('DELETE FROM script_panels WHERE id = ?').run(panelId);
        return null;
      }

      const guildSettings = getGuildSettings(panel.guild_id);
      const payload = this.buildPanelPayload(guildSettings, panel);
      await message.edit(payload);
      return panel;
    } catch (err) {
      console.error('Failed to refresh script panel:', err);
      return null;
    }
  }

  /**
   * Fetches panel by message ID
   */
  static getPanelByMessageId(messageId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM script_panels WHERE message_id = ?').get(messageId);
  }

  /**
   * Deletes a panel
   */
  static async deletePanel(client, panelId) {
    const db = getDatabase();
    const panel = db.prepare('SELECT * FROM script_panels WHERE id = ?').get(panelId);
    if (!panel) return null;

    try {
      const channel = await client.channels.fetch(panel.channel_id).catch(() => null);
      if (channel) {
        const msg = await channel.messages.fetch(panel.message_id).catch(() => null);
        if (msg) await msg.delete().catch(() => {});
      }
    } catch {
      // ignore
    }

    db.prepare('DELETE FROM script_panels WHERE id = ?').run(panelId);
    return panel;
  }
}
