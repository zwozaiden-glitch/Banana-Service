import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { YouTubeService } from '../../services/youtubeService.js';
import { getGuildSettings } from '../../database/db.js';
import { createBananaEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embeds.js';
import { logAuditAction } from '../../utils/auditLogger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('youtube')
    .setDescription('Banana Service YouTube Video Tracker')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Track a YouTube channel for new video uploads')
        .addStringOption(opt =>
          opt.setName('channel')
            .setDescription('YouTube channel URL, handle (@name), or Channel ID')
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName('notification_channel')
            .setDescription('Discord channel to post video announcements')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
        .addRoleOption(opt => opt.setName('ping_role').setDescription('Role to ping when a video is released'))
        .addStringOption(opt => opt.setName('custom_message').setDescription('Custom message header'))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Stop tracking a YouTube channel')
        .addStringOption(opt =>
          opt.setName('channel')
            .setDescription('YouTube channel ID or exact name')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all tracked YouTube channels in this server')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const guildSettings = getGuildSettings(guildId);

    if (subcommand === 'add') {
      await interaction.deferReply();

      const channelInput = interaction.options.getString('channel');
      const discordChannel = interaction.options.getChannel('notification_channel');
      const pingRole = interaction.options.getRole('ping_role');
      const customMessage = interaction.options.getString('custom_message');

      try {
        const added = await YouTubeService.addTracker(
          guildId,
          channelInput,
          discordChannel.id,
          pingRole?.id || null,
          customMessage || null
        );

        await logAuditAction(interaction.client, guildId, {
          userId: interaction.user.id,
          action: 'YOUTUBE_TRACKER_ADDED',
          targetType: 'YouTube',
          targetId: added.channelId,
          details: { channelTitle: added.channelTitle, discordChannelId: discordChannel.id },
        });

        const embed = createSuccessEmbed(
          guildSettings,
          'YouTube Channel Tracked',
          `Now monitoring **${added.channelTitle}**! New videos will be announced in <#${discordChannel.id}>.`
        );

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({
          embeds: [createErrorEmbed(guildSettings, 'Failed to Add YouTube Tracker', err.message)],
        });
      }
    }

    if (subcommand === 'remove') {
      const channelInput = interaction.options.getString('channel');
      try {
        const removed = YouTubeService.removeTracker(guildId, channelInput);

        await logAuditAction(interaction.client, guildId, {
          userId: interaction.user.id,
          action: 'YOUTUBE_TRACKER_REMOVED',
          targetType: 'YouTube',
          targetId: removed.channel_id,
        });

        return interaction.reply({
          embeds: [createSuccessEmbed(guildSettings, 'Tracker Removed', `Stopped monitoring **${removed.channel_name}**.`)],
          ephemeral: true,
        });
      } catch (err) {
        return interaction.reply({
          embeds: [createErrorEmbed(guildSettings, 'Remove Failed', err.message)],
          ephemeral: true,
        });
      }
    }

    if (subcommand === 'list') {
      const trackers = YouTubeService.listTrackers(guildId);
      if (trackers.length === 0) {
        return interaction.reply({
          embeds: [createBananaEmbed(guildSettings, { title: 'Tracked YouTube Channels', description: 'No YouTube channels are currently tracked. Use `/youtube add` to add one!' })],
          ephemeral: true,
        });
      }

      const fields = trackers.map(t => ({
        name: `▶️ ${t.channel_name}`,
        value: `Channel ID: \`${t.channel_id}\`\nAnnouncing in: <#${t.discord_channel_id}>\nPing: ${t.ping_role_id ? `<@&${t.ping_role_id}>` : 'None'}`,
        inline: false,
      }));

      const embed = createBananaEmbed(guildSettings, {
        title: 'Tracked YouTube Channels',
        fields,
      });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
