import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { ModerationService } from '../../services/moderationService.js';
import { getGuildSettings } from '../../database/db.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(opt => opt.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for kick')),

  async execute(interaction) {
    const guildSettings = getGuildSettings(interaction.guild.id);
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason specified';

    const member = interaction.guild.members.cache.get(targetUser.id);
    if (!member) {
      return interaction.reply({ embeds: [createErrorEmbed(guildSettings, 'Error', 'User is not in this server.')], ephemeral: true });
    }

    try {
      await ModerationService.kickMember(interaction.client, member, interaction.member, reason);
      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Member Kicked', `**${targetUser.tag}** has been kicked from the server.\n**Reason:** ${reason}`)],
      });
    } catch (err) {
      return interaction.reply({
        embeds: [createErrorEmbed(guildSettings, 'Kick Failed', err.message)],
        ephemeral: true,
      });
    }
  },
};
