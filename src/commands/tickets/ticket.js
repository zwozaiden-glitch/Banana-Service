import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { TicketService } from '../../services/ticketService.js';
import { getDatabase, getGuildSettings } from '../../database/db.js';
import { BananaPermissions } from '../../utils/permissions.js';
import { createBananaEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embeds.js';
import { logAuditAction } from '../../utils/auditLogger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Banana Service Support & Ticket System')
    .addSubcommand(sub =>
      sub.setName('panel')
        .setDescription('Publish the interactive ticket creation panel in a channel')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to post ticket panel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('close')
        .setDescription('Close the current ticket channel and save transcript')
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for closing ticket'))
    )
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a user to this ticket channel')
        .addUserOption(opt => opt.setName('user').setDescription('User to add').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a user from this ticket channel')
        .addUserOption(opt => opt.setName('user').setDescription('User to remove').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('rename')
        .setDescription('Rename this ticket channel')
        .addStringOption(opt => opt.setName('name').setDescription('New channel name').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('category_add')
        .setDescription('Create a new custom ticket category')
        .addStringOption(opt => opt.setName('slug').setDescription('Unique ID slug (e.g., billing, vip)').setRequired(true))
        .addStringOption(opt => opt.setName('label').setDescription('Display label (e.g. VIP Inquiries)').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('Category description'))
        .addStringOption(opt => opt.setName('emoji').setDescription('Emoji (e.g. 🍌, 💳, ⚙️)'))
        .addRoleOption(opt => opt.setName('support_role').setDescription('Role that handles this category'))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const guildSettings = getGuildSettings(guild.id);
    const db = getDatabase();

    // 1. PANEL
    if (subcommand === 'panel') {
      if (!BananaPermissions.isAdmin(interaction.member) && !BananaPermissions.isStaff(interaction.member, guildSettings)) {
        return interaction.reply({ embeds: [createErrorEmbed(guildSettings, 'Permission Denied', 'Admin or Staff required.')], ephemeral: true });
      }

      const channel = interaction.options.getChannel('channel');
      const categories = TicketService.getCategories(guild.id);
      const payload = TicketService.buildPanelPayload(guildSettings, categories);

      const msg = await channel.send(payload);

      db.prepare(`
        UPDATE ticket_settings
        SET panel_channel_id = ?, panel_message_id = ?
        WHERE guild_id = ?
      `).run(channel.id, msg.id, guild.id);

      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Ticket Panel Deployed', `Ticket panel is live in <#${channel.id}>!`)],
        ephemeral: true,
      });
    }

    // 2. CLOSE
    if (subcommand === 'close') {
      const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ? AND status = "open"').get(interaction.channel.id);
      if (!ticket) {
        return interaction.reply({ embeds: [createErrorEmbed(guildSettings, 'Error', 'This channel is not an active ticket.')], ephemeral: true });
      }

      const reason = interaction.options.getString('reason') || 'Resolved by user/staff';
      return TicketService.closeTicket(interaction.client, interaction, ticket.id, reason);
    }

    // 3. ADD USER
    if (subcommand === 'add') {
      const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(interaction.channel.id);
      if (!ticket) {
        return interaction.reply({ embeds: [createErrorEmbed(guildSettings, 'Error', 'This channel is not a ticket.')], ephemeral: true });
      }

      const user = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });

      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'User Added', `<@${user.id}> has been added to this ticket.`)],
      });
    }

    // 4. REMOVE USER
    if (subcommand === 'remove') {
      const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(interaction.channel.id);
      if (!ticket) {
        return interaction.reply({ embeds: [createErrorEmbed(guildSettings, 'Error', 'This channel is not a ticket.')], ephemeral: true });
      }

      const user = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.delete(user.id);

      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'User Removed', `<@${user.id}> has been removed from this ticket.`)],
      });
    }

    // 5. RENAME
    if (subcommand === 'rename') {
      const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(interaction.channel.id);
      if (!ticket) {
        return interaction.reply({ embeds: [createErrorEmbed(guildSettings, 'Error', 'This channel is not a ticket.')], ephemeral: true });
      }

      const name = interaction.options.getString('name');
      await interaction.channel.setName(name);

      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Ticket Renamed', `Ticket channel renamed to **${name}**.`)],
      });
    }

    // 6. CATEGORY ADD
    if (subcommand === 'category_add') {
      if (!BananaPermissions.isAdmin(interaction.member)) {
        return interaction.reply({ embeds: [createErrorEmbed(guildSettings, 'Permission Denied', 'Administrator required.')], ephemeral: true });
      }

      const slug = interaction.options.getString('slug').toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const label = interaction.options.getString('label');
      const desc = interaction.options.getString('description') || '';
      const emoji = interaction.options.getString('emoji') || '🍌';
      const role = interaction.options.getRole('support_role');

      db.prepare(`
        INSERT INTO ticket_categories (guild_id, slug, label, description, emoji, support_role_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(guild.id, slug, label, desc, emoji, role?.id || null);

      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Category Created', `Custom ticket category **${label}** (${emoji}) added!`)],
        ephemeral: true,
      });
    }
  },
};
