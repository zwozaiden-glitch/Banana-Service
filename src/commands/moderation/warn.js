import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { ModerationService } from '../../services/moderationService.js';
import { getGuildSettings } from '../../database/db.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a formal warning to a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for warning').setRequired(true)),

  async execute(interaction) {
    const guildSettings = getGuildSettings(interaction.guild.id);
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    try {
      const result = await ModerationService.warnMember(
        interaction.client,
        interaction.guild,
        targetUser,
        interaction.member,
        reason
      );

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            guildSettings,
            'Warning Issued',
            `**${targetUser.tag}** received a warning.\n**Reason:** ${reason}\n**Total Warnings:** \`${result.totalWarnings}\``
          ),
        ],
      });
    } catch (err) {
      return interaction.reply({ embeds: [createErrorEmbed(guildSettings, 'Warn Failed', err.message)], ephemeral: true });
    }
  },
};
