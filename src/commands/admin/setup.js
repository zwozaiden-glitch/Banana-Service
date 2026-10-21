import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { getGuildSettings, updateGuildSettings } from '../../database/db.js';
import { createBananaEmbed, createSuccessEmbed } from '../../utils/embeds.js';
import { logAuditAction } from '../../utils/auditLogger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Quick-start configuration wizard for Banana Service channels and staff roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(opt => opt.setName('staff_role').setDescription('Designated staff / moderator role'))
    .addChannelOption(opt =>
      opt.setName('script_channel')
        .setDescription('Channel where scripts are published/discussed')
        .addChannelTypes(ChannelType.GuildText)
    )
    .addChannelOption(opt =>
      opt.setName('announcement_channel')
        .setDescription('Channel for announcements & script release updates')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addChannelOption(opt =>
      opt.setName('modlog_channel')
        .setDescription('Channel for audit logs & moderation notifications')
        .addChannelTypes(ChannelType.GuildText)
    ),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const staffRole = interaction.options.getRole('staff_role');
    const scriptChan = interaction.options.getChannel('script_channel');
    const announceChan = interaction.options.getChannel('announcement_channel');
    const modlogChan = interaction.options.getChannel('modlog_channel');

    const updates = {};
    if (staffRole) updates.staff_role_id = staffRole.id;
    if (scriptChan) updates.script_channel_id = scriptChan.id;
    if (announceChan) updates.announce_channel_id = announceChan.id;
    if (modlogChan) updates.modlog_channel_id = modlogChan.id;

    if (Object.keys(updates).length === 0) {
      const current = getGuildSettings(guildId);
      const embed = createBananaEmbed(current, {
        title: '🍌 Banana Service Setup Status',
        description: 'Provide options in `/setup` to assign channels and roles.',
        fields: [
          { name: 'Staff Role', value: current.staff_role_id ? `<@&${current.staff_role_id}>` : 'Not configured', inline: true },
          { name: 'Script Channel', value: current.script_channel_id ? `<#${current.script_channel_id}>` : 'Not configured', inline: true },
          { name: 'Announce Channel', value: current.announce_channel_id ? `<#${current.announce_channel_id}>` : 'Not configured', inline: true },
          { name: 'Modlog Channel', value: current.modlog_channel_id ? `<#${current.modlog_channel_id}>` : 'Not configured', inline: true },
        ],
      });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const updated = updateGuildSettings(guildId, updates);

    await logAuditAction(interaction.client, guildId, {
      userId: interaction.user.id,
      action: 'GUILD_SETUP_CONFIGURED',
      details: updates,
    });

    const embed = createSuccessEmbed(
      updated,
      'Setup Configured',
      'Banana Service server channels and staff roles have been successfully updated!'
    );

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
