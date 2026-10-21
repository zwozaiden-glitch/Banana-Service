import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { ModerationService } from '../../services/moderationService.js';
import { getGuildSettings } from '../../database/db.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(opt => opt.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for ban'))
    .addIntegerOption(opt =>
      opt.setName('delete_messages_days')
        .setDescription('Number of days of messages to delete (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
    ),

  async execute(interaction) {
    const guildSettings = getGuildSettings(interaction.guild.id);
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason specified';
    const deleteDays = interaction.options.getInteger('delete_messages_days') || 0;

    try {
      await ModerationService.banMember(
        interaction.client,
        interaction.guild,
        targetUser,
        interaction.member,
        deleteDays * 86400,
        reason
      );

      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Member Banned', `**${targetUser.tag}** has been banned from the server.\n**Reason:** ${reason}`)],
      });
    } catch (err) {
      return interaction.reply({
        embeds: [createErrorEmbed(guildSettings, 'Ban Failed', err.message)],
        ephemeral: true,
      });
    }
  },
};
