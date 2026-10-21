import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { ModerationService } from '../../services/moderationService.js';
import { getGuildSettings } from '../../database/db.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages from the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption(opt => opt.setName('user').setDescription('Filter deletion by user (optional)')),

  async execute(interaction) {
    const guildSettings = getGuildSettings(interaction.guild.id);
    const amount = interaction.options.getInteger('amount');
    const filterUser = interaction.options.getUser('user');

    await interaction.deferReply({ ephemeral: true });

    try {
      const deletedCount = await ModerationService.purgeMessages(
        interaction.channel,
        interaction.member,
        amount,
        filterUser
      );

      return interaction.editReply({
        embeds: [createSuccessEmbed(guildSettings, 'Messages Purged', `Successfully cleared **${deletedCount}** message(s).`)],
      });
    } catch (err) {
      return interaction.editReply({
        embeds: [createErrorEmbed(guildSettings, 'Purge Failed', err.message)],
      });
    }
  },
};
