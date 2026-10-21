import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { getGuildSettings } from '../../database/db.js';
import { createBananaEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embeds.js';
import { logAuditAction } from '../../utils/auditLogger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Publish a styled Banana Service announcement')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to send announcement in')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('title')
        .setDescription('Announcement title')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('description')
        .setDescription('Announcement body text')
        .setRequired(true)
    )
    .addRoleOption(opt =>
      opt.setName('ping_role')
        .setDescription('Role to mention with announcement')
    )
    .addStringOption(opt =>
      opt.setName('color')
        .setDescription('Hex color code (e.g. #FFE135)')
    )
    .addStringOption(opt =>
      opt.setName('image_url')
        .setDescription('Image URL to attach')
    ),

  async execute(interaction) {
    const guildSettings = getGuildSettings(interaction.guild.id);
    const channel = interaction.options.getChannel('channel');
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description').replace(/\\n/g, '\n');
    const pingRole = interaction.options.getRole('ping_role');
    const color = interaction.options.getString('color');
    const imageUrl = interaction.options.getString('image_url');

    try {
      const embed = createBananaEmbed(guildSettings, {
        title,
        description,
        color: color || '#FFE135',
        image: imageUrl || null,
        footerText: `Announcement by ${interaction.user.tag}`,
      });

      const content = pingRole ? `<@&${pingRole.id}>` : undefined;

      const sent = await channel.send({ content, embeds: [embed] });

      await logAuditAction(interaction.client, interaction.guild.id, {
        userId: interaction.user.id,
        action: 'ANNOUNCEMENT_SENT',
        targetType: 'Channel',
        targetId: channel.id,
        details: { title, messageId: sent.id },
      });

      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Announcement Published', `Announcement was sent to <#${channel.id}>!`)],
        ephemeral: true,
      });
    } catch (err) {
      return interaction.reply({
        embeds: [createErrorEmbed(guildSettings, 'Failed to Send Announcement', err.message)],
        ephemeral: true,
      });
    }
  },
};
