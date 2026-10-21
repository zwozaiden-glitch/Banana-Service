import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { getDatabase, getGuildSettings } from '../database/db.js';
import { createBananaEmbed, createSuccessEmbed, createErrorEmbed } from '../utils/embeds.js';
import { getGuildEmoji } from '../utils/emojis.js';

export class GiveawayService {
  static activeTimers = new Map();

  /**
   * Builds the Giveaway Embed & Enter Button
   */
  static buildGiveawayMessage(guildSettings, giveaway, entryCount = 0, ended = false, winners = []) {
    const bananaParty = getGuildEmoji(guildSettings, 'bananaParty');
    const bananaSparkle = getGuildEmoji(guildSettings, 'bananaSparkle');
    const endsUnix = Math.floor(giveaway.ends_at / 1000);

    const fields = [
      { name: '🎁 Prize', value: `**${giveaway.prize}**`, inline: true },
      { name: '👥 Winners', value: `${giveaway.winner_count}`, inline: true },
      { name: '🎟️ Total Entries', value: `${entryCount}`, inline: true },
    ];

    if (giveaway.required_role_id) {
      fields.push({ name: '🔒 Required Role', value: `<@&${giveaway.required_role_id}>`, inline: true });
    }
    if (giveaway.sponsor) {
      fields.push({ name: '🌟 Sponsored by', value: giveaway.sponsor, inline: true });
    }

    if (!ended) {
      fields.push({ name: '⏳ Ends', value: `<t:${endsUnix}:R> (<t:${endsUnix}:f>)`, inline: false });
    } else {
      const winnerMentions = winners.length > 0
        ? winners.map(w => `<@${w.user_id}>`).join(', ')
        : 'No valid entries.';
      fields.push({ name: '🏆 Winners', value: winnerMentions, inline: false });
    }

    const embed = createBananaEmbed(guildSettings, {
      title: `${bananaParty} ${ended ? 'GIVEAWAY ENDED' : 'BANANA SERVICE GIVEAWAY'}`,
      description: giveaway.description || `Click the button below to enter the **${giveaway.prize}** giveaway!`,
      fields,
      color: ended ? '#4B5563' : '#F7B731',
      footerText: ended ? 'Giveaway concluded' : 'Banana Service • Giveaways',
    });

    const components = [];
    if (!ended) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`giveaway_enter_${giveaway.id}`)
          .setLabel(`Enter (${entryCount})`)
          .setStyle(ButtonStyle.Success)
          .setEmoji(getGuildEmoji(guildSettings, 'giveaway'))
      );
      components.push(row);
    }

    return { embeds: [embed], components };
  }

  /**
   * Creates and starts a new giveaway
   */
  static async createGiveaway(client, {
    guild,
    channel,
    prize,
    durationMs,
    winnerCount = 1,
    requiredRoleId = null,
    minAccountAgeDays = 0,
    minMembershipDays = 0,
    sponsor = null,
    description = null,
    createdBy,
  }) {
    const db = getDatabase();
    const guildSettings = getGuildSettings(guild.id);
    const endsAt = Date.now() + durationMs;

    // Preliminary DB record
    const insert = db.prepare(`
      INSERT INTO giveaways (
        guild_id, channel_id, message_id, prize, winner_count, required_role_id,
        min_account_age_days, min_membership_days, sponsor, description, ends_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = insert.run(
      guild.id,
      channel.id,
      'temp_' + Date.now(),
      prize,
      winnerCount,
      requiredRoleId,
      minAccountAgeDays,
      minMembershipDays,
      sponsor,
      description,
      endsAt,
      createdBy
    );

    const giveawayId = info.lastInsertRowid;
    const giveaway = db.prepare('SELECT * FROM giveaways WHERE id = ?').get(giveawayId);

    const payload = this.buildGiveawayMessage(guildSettings, giveaway, 0, false);
    const message = await channel.send(payload);

    db.prepare('UPDATE giveaways SET message_id = ? WHERE id = ?').run(message.id, giveawayId);
    giveaway.message_id = message.id;

    // Schedule end timer
    this.scheduleGiveawayEnd(client, giveaway);

    return giveaway;
  }

  /**
   * Handles user entry into a giveaway
   */
  static async handleEntry(client, interaction, giveawayId) {
    const db = getDatabase();
    const giveaway = db.prepare('SELECT * FROM giveaways WHERE id = ?').get(giveawayId);

    if (!giveaway || giveaway.ended) {
      return interaction.reply({ content: '❌ This giveaway has already ended.', ephemeral: true });
    }

    const member = interaction.member;
    const now = Date.now();

    // Check required role
    if (giveaway.required_role_id && !member.roles.cache.has(giveaway.required_role_id)) {
      return interaction.reply({
        content: `❌ You must have the <@&${giveaway.required_role_id}> role to enter this giveaway.`,
        ephemeral: true,
      });
    }

    // Check account age
    if (giveaway.min_account_age_days > 0) {
      const accountAgeDays = (now - member.user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (accountAgeDays < giveaway.min_account_age_days) {
        return interaction.reply({
          content: `❌ Your account must be at least ${giveaway.min_account_age_days} days old to enter.`,
          ephemeral: true,
        });
      }
    }

    // Check membership age
    if (giveaway.min_membership_days > 0 && member.joinedTimestamp) {
      const membershipDays = (now - member.joinedTimestamp) / (1000 * 60 * 60 * 24);
      if (membershipDays < giveaway.min_membership_days) {
        return interaction.reply({
          content: `❌ You must have been in the server for at least ${giveaway.min_membership_days} days to enter.`,
          ephemeral: true,
        });
      }
    }

    // Check if already entered
    const existing = db.prepare('SELECT id FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?').get(giveaway.id, member.id);

    if (existing) {
      // Leave giveaway
      db.prepare('DELETE FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?').run(giveaway.id, member.id);
      const count = db.prepare('SELECT COUNT(*) as c FROM giveaway_entries WHERE giveaway_id = ?').get(giveaway.id).c;
      await this.updateGiveawayMessage(client, giveaway, count);
      return interaction.reply({ content: '🍌 You have left the giveaway.', ephemeral: true });
    }

    // Insert entry
    db.prepare('INSERT INTO giveaway_entries (giveaway_id, user_id) VALUES (?, ?)').run(giveaway.id, member.id);
    const count = db.prepare('SELECT COUNT(*) as c FROM giveaway_entries WHERE giveaway_id = ?').get(giveaway.id).c;

    await this.updateGiveawayMessage(client, giveaway, count);
    return interaction.reply({ content: `🍌✨ You have entered the giveaway for **${giveaway.prize}**! Good luck!`, ephemeral: true });
  }

  static async updateGiveawayMessage(client, giveaway, count) {
    try {
      const channel = client.channels.cache.get(giveaway.channel_id) || await client.channels.fetch(giveaway.channel_id).catch(() => null);
      if (!channel) return;

      const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
      if (!message) return;

      const guildSettings = getGuildSettings(giveaway.guild_id);
      const payload = this.buildGiveawayMessage(guildSettings, giveaway, count, false);
      await message.edit(payload);
    } catch {
      // ignore
    }
  }

  /**
   * Concludes a giveaway and picks winners
   */
  static async endGiveaway(client, giveawayId, reroll = false) {
    const db = getDatabase();
    const giveaway = db.prepare('SELECT * FROM giveaways WHERE id = ?').get(giveawayId);
    if (!giveaway) return null;

    if (!reroll && giveaway.ended) return null;

    const entries = db.prepare('SELECT user_id FROM giveaway_entries WHERE giveaway_id = ?').all(giveaway.id);
    const winners = [];

    if (entries.length > 0) {
      // Shuffle entries using Fisher-Yates
      const shuffled = [...entries];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const countToPick = Math.min(giveaway.winner_count, shuffled.length);
      for (let i = 0; i < countToPick; i++) {
        winners.push(shuffled[i]);
      }
    }

    // Save winners
    if (!reroll) {
      db.prepare('UPDATE giveaways SET ended = 1 WHERE id = ?').run(giveaway.id);
    }

    for (const w of winners) {
      db.prepare('INSERT INTO giveaway_winners (giveaway_id, user_id, is_reroll) VALUES (?, ?, ?)').run(
        giveaway.id,
        w.user_id,
        reroll ? 1 : 0
      );
    }

    // Update Discord message
    try {
      const channel = client.channels.cache.get(giveaway.channel_id) || await client.channels.fetch(giveaway.channel_id).catch(() => null);
      if (channel) {
        const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
        const guildSettings = getGuildSettings(giveaway.guild_id);

        if (message) {
          const payload = this.buildGiveawayMessage(guildSettings, giveaway, entries.length, true, winners);
          await message.edit(payload);
        }

        // Send winner announcement
        const winnerPings = winners.map(w => `<@${w.user_id}>`).join(', ');
        if (winners.length > 0) {
          await channel.send({
            content: `🎉 Congratulations ${winnerPings}! You won **${giveaway.prize}**! 🍌✨`,
          });
        } else {
          await channel.send({
            content: `🍌 The giveaway for **${giveaway.prize}** ended, but there were no valid entries.`,
          });
        }
      }
    } catch (err) {
      console.error('Failed to update giveaway on completion:', err);
    }

    return winners;
  }

  /**
   * Schedules timer or immediate end
   */
  static scheduleGiveawayEnd(client, giveaway) {
    if (this.activeTimers.has(giveaway.id)) {
      clearTimeout(this.activeTimers.get(giveaway.id));
    }

    const timeLeft = giveaway.ends_at - Date.now();
    if (timeLeft <= 0) {
      this.endGiveaway(client, giveaway.id);
      return;
    }

    const timer = setTimeout(() => {
      this.endGiveaway(client, giveaway.id);
      this.activeTimers.delete(giveaway.id);
    }, timeLeft);

    this.activeTimers.set(giveaway.id, timer);
  }

  /**
   * Restores all active giveaways on bot startup
   */
  static restoreGiveaways(client) {
    const db = getDatabase();
    const active = db.prepare('SELECT * FROM giveaways WHERE ended = 0').all();

    console.log(`[Giveaway Service] Restoring ${active.length} active giveaways...`);
    for (const g of active) {
      this.scheduleGiveawayEnd(client, g);
    }
  }

  static cancelGiveaway(giveawayId) {
    const db = getDatabase();
    if (this.activeTimers.has(giveawayId)) {
      clearTimeout(this.activeTimers.get(giveawayId));
      this.activeTimers.delete(giveawayId);
    }
    db.prepare('UPDATE giveaways SET ended = 1 WHERE id = ?').run(giveawayId);
  }
}
