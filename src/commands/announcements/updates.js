import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { AnnouncementService } from '../../services/announcementService.js';
import { getGuildSettings } from '../../database/db.js';
import { createBananaEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embeds.js';
import { logAuditAction } from '../../utils/auditLogger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('updates')
    .setDescription('Configure automatic script release & update announcements')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('enable')
        .setDescription('Enable automatic announcements for uploaded and updated scripts')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel where announcements should be sent')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
        .addRoleOption(opt => opt.setName('ping_role').setDescription('Role to ping on updates (optional)'))
        .addBooleanOption(opt => opt.setName('download_button').setDescription('Include direct download button on announcement'))
    )
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Disable automatic script release announcements')
    )
    .addSubcommand(sub =>
      sub.setName('config')
        .setDescription('View current automatic update settings')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const guildSettings = getGuildSettings(guildId);

    if (subcommand === 'enable') {
      const channel = interaction.options.getChannel('channel');
      const pingRole = interaction.options.getRole('ping_role');
      const dlButton = interaction.options.getBoolean('download_button') ?? true;

      AnnouncementService.configureAutoUpdates(guildId, {
        enabled: true,
        channelId: channel.id,
        pingRoleId: pingRole?.id || null,
        includeDownloadButton: dlButton,
      });

      await logAuditAction(interaction.client, guildId, {
        userId: interaction.user.id,
        action: 'AUTO_UPDATES_ENABLED',
        details: { channelId: channel.id, pingRoleId: pingRole?.id },
      });

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            guildSettings,
            'Auto Updates Enabled',
            `Banana Service will now automatically announce new script releases and updates in <#${channel.id}>!`
          ),
        ],
        ephemeral: true,
      });
    }

    if (subcommand === 'disable') {
      AnnouncementService.configureAutoUpdates(guildId, { enabled: false });

      await logAuditAction(interaction.client, guildId, {
        userId: interaction.user.id,
        action: 'AUTO_UPDATES_DISABLED',
      });

      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Auto Updates Disabled', 'Automatic script announcements have been turned off.')],
        ephemeral: true,
      });
    }

    if (subcommand === 'config') {
      const current = AnnouncementService.getAutoUpdateConfig(guildId);
      if (!current || !current.enabled) {
        return interaction.reply({
          embeds: [createBananaEmbed(guildSettings, { title: 'Auto Updates Config', description: 'Automatic script updates are currently **disabled**. Use `/updates enable` to set up.' })],
          ephemeral: true,
        });
      }

      const embed = createBananaEmbed(guildSettings, {
        title: '📢 Auto Updates Configuration',
        fields: [
          { name: 'Status', value: '🟢 **Enabled**', inline: true },
          { name: 'Announcement Channel', value: `<#${current.channel_id}>`, inline: true },
          { name: 'Ping Role', value: current.ping_role_id ? `<@&${current.ping_role_id}>` : 'None', inline: true },
          { name: 'Download Button', value: current.include_download_button ? 'Yes' : 'No', inline: true },
        ],
      });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
