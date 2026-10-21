import { SlashCommandBuilder } from 'discord.js';
import { FeedbackService } from '../../services/feedbackService.js';
import { getGuildSettings } from '../../database/db.js';
import { createSuccessEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Quickly submit a suggestion for the server or bot')
    .addStringOption(opt => opt.setName('idea').setDescription('Your suggestion or idea').setRequired(true)),

  async execute(interaction) {
    const guildSettings = getGuildSettings(interaction.guild?.id);
    const idea = interaction.options.getString('idea');

    await FeedbackService.submitFeedback(interaction.client, {
      guildId: interaction.guild.id,
      type: 'general',
      userId: interaction.user.id,
      userTag: interaction.user.tag,
      title: 'Member Suggestion',
      content: idea,
    });

    return interaction.reply({
      embeds: [createSuccessEmbed(guildSettings, 'Suggestion Submitted', 'Thank you! Your suggestion has been recorded for review by staff. 🍌')],
      ephemeral: true,
    });
  },
};
