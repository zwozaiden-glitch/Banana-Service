import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { getDatabase, getGuildSettings } from '../database/db.js';
import { createBananaEmbed, createSuccessEmbed } from '../utils/embeds.js';
import { getGuildEmoji } from '../utils/emojis.js';

export class FeedbackService {
  /**
   * Submits general or script feedback
   */
  static async submitFeedback(client, {
    guildId,
    type = 'general',
    scriptId = null,
    userId,
    userTag,
    title,
    content,
    rating = null,
  }) {
    const db = getDatabase();
    const insert = db.prepare(`
      INSERT INTO feedback (guild_id, type, script_id, user_id, user_tag, title, content, rating, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `);

    const info = insert.run(
      guildId,
      type,
      scriptId || null,
      userId,
      userTag,
      title.trim(),
      content.trim(),
      rating
    );

    const feedbackId = info.lastInsertRowid;
    const feedbackRecord = db.prepare('SELECT * FROM feedback WHERE id = ?').get(feedbackId);

    // Forward to staff modlog / review channel if configured
    try {
      const guildSettings = getGuildSettings(guildId);
      if (guildSettings.modlog_channel_id) {
        const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
        if (guild) {
          const channel = guild.channels.cache.get(guildSettings.modlog_channel_id);
          if (channel && channel.isTextBased()) {
            const embed = createBananaEmbed(guildSettings, {
              title: `💬 New Feedback Submitted (#${feedbackId})`,
              description: `**${feedbackRecord.title}**\n\n${feedbackRecord.content}`,
              fields: [
                { name: 'Type', value: feedbackRecord.type.toUpperCase(), inline: true },
                { name: 'Submitted By', value: `<@${userId}> (${userTag})`, inline: true },
                { name: 'Rating', value: rating ? `${rating} ⭐` : 'N/A', inline: true },
                ...(scriptId ? [{ name: 'Script ID', value: String(scriptId), inline: true }] : []),
              ],
              color: '#F59E0B',
            });

            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`fb_accept_${feedbackId}`)
                .setLabel('Accept')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId(`fb_reject_${feedbackId}`)
                .setLabel('Reject')
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId(`fb_progress_${feedbackId}`)
                .setLabel('In Progress')
                .setStyle(ButtonStyle.Primary)
            );

            await channel.send({ embeds: [embed], components: [row] });
          }
        }
      }
    } catch (err) {
      console.warn('Failed to dispatch feedback to staff channel:', err);
    }

    return feedbackRecord;
  }

  /**
   * Updates status of a feedback item
   */
  static updateStatus(feedbackId, status, staffId, staffNotes = null) {
    const db = getDatabase();
    db.prepare(`
      UPDATE feedback
      SET status = ?, staff_id = ?, staff_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, staffId, staffNotes, feedbackId);

    return db.prepare('SELECT * FROM feedback WHERE id = ?').get(feedbackId);
  }

  /**
   * Lists feedback entries for a guild
   */
  static listFeedback(guildId, { type = null, status = null, limit = 10 } = {}) {
    const db = getDatabase();
    let query = 'SELECT * FROM feedback WHERE guild_id = ?';
    const params = [guildId];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY id DESC LIMIT ?';
    params.push(limit);

    return db.prepare(query).all(...params);
  }
}
