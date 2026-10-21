import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { ModerationService } from '../../services/moderationService.js';
import { getGuildSettings } from '../../database/db.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout/mute a member temporarily')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .addIntegerOption(opt => opt.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for timeout')),

  async execute(interaction) {
    const guildSettings = getGuildSettings(interaction.guild.id);
    const targetUser = interaction.options.getUser('user');
    const minutes = interaction.options.getInteger('minutes');
    const reason = interaction.options.getString('reason') || 'No reason specified';

    const member = interaction.guild.members.cache.get(targetUser.id);
    if (!member) {
      return interaction.reply({ embeds: [createErrorEmbed(guildSettings, 'Error', 'User not found in server.')], ephemeral: true });
    }

    try {
      await ModerationService.timeoutMember(interaction.client, member, interaction.member, minutes * 60 * 1000, reason);
      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Member Timed Out', `**${targetUser.tag}** has been timed out for **${minutes} minute(s)**.\n**Reason:** ${reason}`)],
      });
    } catch (err) {
      return interaction.reply({
        embeds: [createErrorEmbed(guildSettings, 'Timeout Failed', err.message)],
        ephemeral: true,
      });
    }
  },
};
