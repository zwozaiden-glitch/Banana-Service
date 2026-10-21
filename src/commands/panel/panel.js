import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { PanelService } from '../../services/panelService.js';
import { getGuildSettings, getDatabase } from '../../database/db.js';
import { BananaPermissions } from '../../utils/permissions.js';
import { createSuccessEmbed, createErrorEmbed, createBananaEmbed } from '../../utils/embeds.js';
import { logAuditAction } from '../../utils/auditLogger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Banana Service Interactive Script Hub Panels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('publish')
        .setDescription('Publish an interactive Script Hub Panel in a channel')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Destination channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption(opt => opt.setName('title').setDescription('Custom panel title'))
        .addStringOption(opt => opt.setName('description').setDescription('Custom panel description'))
        .addStringOption(opt => opt.setName('banner_url').setDescription('Banner image URL (optional)'))
    )
    .addSubcommand(sub =>
      sub.setName('refresh')
        .setDescription('Refresh an existing panel embed and buttons')
        .addIntegerOption(opt => opt.setName('panel_id').setDescription('Panel ID to refresh').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all published panels in the server')
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete a script panel and remove its message')
        .addIntegerOption(opt => opt.setName('panel_id').setDescription('Panel ID to delete').setRequired(true))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const guildSettings = getGuildSettings(guild.id);

    if (!BananaPermissions.isAdmin(interaction.member) && !BananaPermissions.isStaff(interaction.member, guildSettings)) {
      return interaction.reply({
        embeds: [createErrorEmbed(guildSettings, 'Permission Denied', 'You need Staff or Administrator permissions to manage panels.')],
        ephemeral: true,
      });
    }

    // 1. PUBLISH
    if (subcommand === 'publish') {
      const channel = interaction.options.getChannel('channel');
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const bannerUrl = interaction.options.getString('banner_url');

      try {
        const panel = await PanelService.publishPanel(guild, channel, {
          title,
          description,
          bannerUrl,
        });

        await logAuditAction(interaction.client, guild.id, {
          userId: interaction.user.id,
          action: 'PANEL_PUBLISH',
          targetType: 'Panel',
          targetId: panel.id,
          details: { channelId: channel.id, messageId: panel.message_id },
        });

        return interaction.reply({
          embeds: [createSuccessEmbed(guildSettings, 'Panel Published', `Script Panel **#${panel.id}** is live in <#${channel.id}>!`)],
          ephemeral: true,
        });
      } catch (err) {
        return interaction.reply({
          embeds: [createErrorEmbed(guildSettings, 'Failed to Publish Panel', err.message)],
          ephemeral: true,
        });
      }
    }

    // 2. REFRESH
    if (subcommand === 'refresh') {
      const panelId = interaction.options.getInteger('panel_id');
      const refreshed = await PanelService.refreshPanel(interaction.client, panelId);

      if (!refreshed) {
        return interaction.reply({
          embeds: [createErrorEmbed(guildSettings, 'Refresh Failed', `Panel #${panelId} not found or message was deleted.`)],
          ephemeral: true,
        });
      }

      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Panel Refreshed', `Script Hub Panel #${panelId} has been updated.`)],
        ephemeral: true,
      });
    }

    // 3. LIST
    if (subcommand === 'list') {
      const db = getDatabase();
      const panels = db.prepare('SELECT * FROM script_panels WHERE guild_id = ?').all(guild.id);

      if (panels.length === 0) {
        return interaction.reply({
          embeds: [createBananaEmbed(guildSettings, { title: 'Script Panels', description: 'No active script panels found. Use `/panel publish` to create one!' })],
          ephemeral: true,
        });
      }

      const fields = panels.map(p => ({
        name: `Panel #${p.id} • ${p.title}`,
        value: `Channel: <#${p.channel_id}> • Message ID: \`${p.message_id}\``,
        inline: false,
      }));

      const embed = createBananaEmbed(guildSettings, {
        title: 'Active Script Panels',
        fields,
      });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // 4. DELETE
    if (subcommand === 'delete') {
      const panelId = interaction.options.getInteger('panel_id');
      const deleted = await PanelService.deletePanel(interaction.client, panelId);

      if (!deleted) {
        return interaction.reply({
          embeds: [createErrorEmbed(guildSettings, 'Not Found', `Panel #${panelId} was not found.`)],
          ephemeral: true,
        });
      }

      await logAuditAction(interaction.client, guild.id, {
        userId: interaction.user.id,
        action: 'PANEL_DELETE',
        targetType: 'Panel',
        targetId: panelId,
      });

      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Panel Removed', `Panel #${panelId} has been deleted.`)],
        ephemeral: true,
      });
    }
  },
};
