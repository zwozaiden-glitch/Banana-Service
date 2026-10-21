import { ContextMenuCommandBuilder, ApplicationCommandType } from 'discord.js';
import { TranslationService } from '../../services/translationService.js';
import { getGuildSettings } from '../../database/db.js';
import { createBananaEmbed, createErrorEmbed } from '../../utils/embeds.js';

export default {
  data: new ContextMenuCommandBuilder()
    .setName('Translate to French')
    .setType(ApplicationCommandType.Message),

  async execute(interaction) {
    const message = interaction.targetMessage;
    const guildSettings = getGuildSettings(interaction.guild?.id);

    if (!message.content || message.content.trim().length === 0) {
      return interaction.reply({
        embeds: [createErrorEmbed(guildSettings, 'No Content', 'Selected message has no text content to translate.')],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const translated = await TranslationService.translateText(message.content, 'fr', 'auto');
      const embed = createBananaEmbed(guildSettings, {
        title: '🌐 French Translation',
        fields: [
          { name: 'Original', value: message.content.slice(0, 1024) },
          { name: 'Traduction', value: translated.slice(0, 1024) },
        ],
        footerText: `Author: ${message.author.tag}`,
      });

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      return interaction.editReply({
        embeds: [createErrorEmbed(guildSettings, 'Translation Failed', err.message)],
      });
    }
  },
};
