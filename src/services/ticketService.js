import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { getDatabase, getGuildSettings } from '../database/db.js';
import { createBananaEmbed, createSuccessEmbed, createErrorEmbed } from '../utils/embeds.js';
import { getGuildEmoji } from '../utils/emojis.js';
import { generateHtmlTranscript, generateTextTranscript } from '../utils/transcriptGenerator.js';

export class TicketService {
  /**
   * Initializes default categories if none exist for a guild
   */
  static ensureDefaultCategories(guildId) {
    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM ticket_categories WHERE guild_id = ?').all(guildId);
    if (existing.length === 0) {
      const insert = db.prepare(`
        INSERT INTO ticket_categories (guild_id, slug, label, description, emoji, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insert.run(guildId, 'general', 'General Support', 'Assistance with general inquiries', '🍌', 1);
      insert.run(guildId, 'scripts', 'Script Support', 'Help with Lua/text scripts and errors', '🛠️', 2);
      insert.run(guildId, 'bugs', 'Bug Report', 'Report bot issues or script bugs', '🐛', 3);
      insert.run(guildId, 'other', 'Other Inquiries', 'Questions not covered above', '📩', 4);
    }
  }

  /**
   * Returns all ticket categories for a guild
   */
  static getCategories(guildId) {
    this.ensureDefaultCategories(guildId);
    const db = getDatabase();
    return db.prepare('SELECT * FROM ticket_categories WHERE guild_id = ? ORDER BY sort_order ASC, id ASC').all(guildId);
  }

  static getTicketSettings(guildId) {
    const db = getDatabase();
    let settings = db.prepare('SELECT * FROM ticket_settings WHERE guild_id = ?').get(guildId);
    if (!settings) {
      db.prepare('INSERT INTO ticket_settings (guild_id) VALUES (?)').run(guildId);
      settings = db.prepare('SELECT * FROM ticket_settings WHERE guild_id = ?').get(guildId);
    }
    return settings;
  }

  /**
   * Builds the Ticket Panel Embed and Selection Menu
   */
  static buildPanelPayload(guildSettings, categories) {
    const bananaTicket = getGuildEmoji(guildSettings, 'bananaTicket');
    const embed = createBananaEmbed(guildSettings, {
      title: '🍌 Banana Service — Support & Ticket Desk',
      description: 'Need assistance, script help, or want to report a bug?\nSelect the appropriate department from the menu below to open a private ticket with our staff.',
      fields: categories.map(cat => ({
        name: `${cat.emoji || '🍌'} ${cat.label}`,
        value: cat.description || 'Click to open a ticket',
        inline: true,
      })),
      color: '#FFE135',
      footerText: 'Banana Service • Support Portal',
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('ticket_create_select')
      .setPlaceholder('Choose a ticket category...')
      .addOptions(
        categories.map(c =>
          new StringSelectMenuOptionBuilder()
            .setLabel(c.label.slice(0, 100))
            .setDescription((c.description || 'Open a support ticket').slice(0, 100))
            .setValue(String(c.id))
            .setEmoji(c.emoji || '🍌')
        )
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);
    return { embeds: [embed], components: [row] };
  }

  /**
   * Creates a new private ticket channel
   */
  static async createTicket(client, interaction, categoryId) {
    const db = getDatabase();
    const guild = interaction.guild;
    const member = interaction.member;
    const guildSettings = getGuildSettings(guild.id);
    const ticketSettings = this.getTicketSettings(guild.id);

    const category = db.prepare('SELECT * FROM ticket_categories WHERE id = ? AND guild_id = ?').get(categoryId, guild.id);
    if (!category) {
      return interaction.reply({ content: '❌ Selected ticket category does not exist.', ephemeral: true });
    }

    // Check maximum open tickets per member
    const openCount = db.prepare(`
      SELECT COUNT(*) as c FROM tickets
      WHERE guild_id = ? AND creator_id = ? AND status = 'open'
    `).get(guild.id, member.id).c;

    if (openCount >= (ticketSettings.max_open_tickets || 3)) {
      return interaction.reply({
        content: `❌ You already have ${openCount} open ticket(s). Please close existing tickets before opening a new one.`,
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    // Next ticket sequence number
    const maxNumRow = db.prepare('SELECT MAX(ticket_num) as maxNum FROM tickets WHERE guild_id = ?').get(guild.id);
    const nextTicketNum = (maxNumRow?.maxNum || 0) + 1;
    const channelName = (ticketSettings.naming_scheme || 'ticket-{number}')
      .replace('{number}', String(nextTicketNum).padStart(4, '0'))
      .replace('{user}', member.user.username.toLowerCase().replace(/[^a-z0-9]/g, ''))
      .slice(0, 100);

    // Build permission overwrites:
    // 1. @everyone: Deny ViewChannel
    // 2. Bot: Allow ViewChannel, SendMessages, EmbedLinks, AttachFiles, ManageChannels
    // 3. Member: Allow ViewChannel, SendMessages, AttachFiles, EmbedLinks
    // 4. Category / Guild Staff Role: Allow ViewChannel, SendMessages, AttachFiles
    const permissionOverwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ];

    const supportRoleId = category.support_role_id || ticketSettings.staff_role_id || guildSettings.staff_role_id;
    if (supportRoleId && guild.roles.cache.has(supportRoleId)) {
      permissionOverwrites.push({
        id: supportRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      });
    }

    // Create channel
    const parentCategory = category.discord_category_id || ticketSettings.category_id || undefined;
    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: parentCategory && guild.channels.cache.has(parentCategory) ? parentCategory : undefined,
      permissionOverwrites,
      topic: `Banana Service Ticket #${nextTicketNum} | Creator: ${member.user.tag} (${member.id}) | Category: ${category.label}`,
    });

    // Record ticket in database
    const insertTicket = db.prepare(`
      INSERT INTO tickets (guild_id, channel_id, ticket_num, category_id, creator_id, status)
      VALUES (?, ?, ?, ?, ?, 'open')
    `);
    const info = insertTicket.run(guild.id, ticketChannel.id, nextTicketNum, category.id, member.id);
    const ticketRecord = db.prepare('SELECT * FROM tickets WHERE id = ?').get(info.lastInsertRowid);

    // Build Welcome Embed inside the new ticket
    const welcomeEmbed = createBananaEmbed(guildSettings, {
      title: `${category.emoji || '🍌'} Ticket #${nextTicketNum} — ${category.label}`,
      description: category.welcome_message || `Hello <@${member.id}>! Support staff will be with you shortly.\nPlease describe your issue or question in detail.`,
      fields: [
        { name: '👤 Creator', value: `<@${member.id}>`, inline: true },
        { name: '📁 Category', value: category.label, inline: true },
        { name: '⚡ Priority', value: 'Normal', inline: true },
      ],
      color: '#FFE135',
    });

    // Action buttons inside ticket channel: Claim, Close, Transcript
    const controlsRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_claim_${ticketRecord.id}`)
        .setLabel('Claim')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🙋‍♂️'),
      new ButtonBuilder()
        .setCustomId(`ticket_close_${ticketRecord.id}`)
        .setLabel('Close')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒'),
      new ButtonBuilder()
        .setCustomId(`ticket_transcript_${ticketRecord.id}`)
        .setLabel('Transcript')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📜')
    );

    await ticketChannel.send({
      content: `<@${member.id}> ${supportRoleId ? `<@&${supportRoleId}>` : ''}`,
      embeds: [welcomeEmbed],
      components: [controlsRow],
    });

    return interaction.editReply({
      content: `🍌 Ticket created successfully! View your ticket here: <#${ticketChannel.id}>`,
    });
  }

  /**
   * Handles Ticket Claim
   */
  static async claimTicket(interaction, ticketId) {
    const db = getDatabase();
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
    if (!ticket || ticket.status !== 'open') {
      return interaction.reply({ content: '❌ Ticket is closed or not found.', ephemeral: true });
    }

    if (ticket.claimed_by) {
      return interaction.reply({ content: `⚠️ This ticket is already claimed by <@${ticket.claimed_by}>.`, ephemeral: true });
    }

    db.prepare('UPDATE tickets SET claimed_by = ? WHERE id = ?').run(interaction.user.id, ticket.id);

    const embed = createSuccessEmbed(
      getGuildSettings(ticket.guild_id),
      'Ticket Claimed',
      `<@${interaction.user.id}> has claimed this ticket and will assist you!`
    );

    await interaction.reply({ embeds: [embed] });
  }

  /**
   * Closes a ticket, generates transcript, and posts to transcript channel
   */
  static async closeTicket(client, interaction, ticketId, reason = 'Resolved') {
    const db = getDatabase();
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
    if (!ticket) {
      return interaction.reply({ content: '❌ Ticket record not found.', ephemeral: true });
    }

    await interaction.deferReply();

    const channel = interaction.channel;
    const htmlTranscript = await generateHtmlTranscript(channel, {
      ...ticket,
      closed_by: interaction.user.tag,
      close_reason: reason,
    });

    db.prepare(`
      UPDATE tickets
      SET status = 'closed', closed_by = ?, close_reason = ?, closed_at = CURRENT_TIMESTAMP, transcript_path = ?
      WHERE id = ?
    `).run(interaction.user.id, reason, htmlTranscript.filePath, ticket.id);

    const guildSettings = getGuildSettings(ticket.guild_id);
    const ticketSettings = this.getTicketSettings(ticket.guild_id);

    // Send copy to transcript log channel if configured
    if (ticketSettings.transcript_channel_id || guildSettings.modlog_channel_id) {
      const logChannelId = ticketSettings.transcript_channel_id || guildSettings.modlog_channel_id;
      const logChannel = interaction.guild.channels.cache.get(logChannelId);
      if (logChannel && logChannel.isTextBased()) {
        const logEmbed = createBananaEmbed(guildSettings, {
          title: `Ticket #${ticket.ticket_num} Closed & Archived`,
          fields: [
            { name: 'Creator', value: `<@${ticket.creator_id}>`, inline: true },
            { name: 'Closed by', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Reason', value: reason, inline: false },
          ],
        });
        await logChannel.send({ embeds: [logEmbed], files: [htmlTranscript.filePath] }).catch(() => {});
      }
    }

    const closeEmbed = createBananaEmbed(guildSettings, {
      title: '🔒 Ticket Closed',
      description: `This ticket has been closed by <@${interaction.user.id}>.\nReason: **${reason}**\n\nUse the buttons below to re-open or permanently delete this channel.`,
      color: '#EF4444',
    });

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_reopen_${ticket.id}`)
        .setLabel('Re-open Ticket')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🔓'),
      new ButtonBuilder()
        .setCustomId(`ticket_delete_${ticket.id}`)
        .setLabel('Delete Channel')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️')
    );

    // Restrict creator permissions
    await channel.permissionOverwrites.edit(ticket.creator_id, {
      SendMessages: false,
      ViewChannel: true,
    }).catch(() => {});

    await interaction.editReply({ embeds: [closeEmbed], components: [actionRow] });
  }

  /**
   * Reopens a closed ticket
   */
  static async reopenTicket(interaction, ticketId) {
    const db = getDatabase();
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
    if (!ticket) return;

    db.prepare(`UPDATE tickets SET status = 'open', closed_by = NULL, close_reason = NULL, closed_at = NULL WHERE id = ?`).run(ticket.id);

    // Restore creator permissions
    await interaction.channel.permissionOverwrites.edit(ticket.creator_id, {
      SendMessages: true,
      ViewChannel: true,
    }).catch(() => {});

    const embed = createSuccessEmbed(
      getGuildSettings(ticket.guild_id),
      'Ticket Reopened',
      `Ticket has been re-opened by <@${interaction.user.id}>.`
    );

    await interaction.reply({ embeds: [embed] });
  }
}
