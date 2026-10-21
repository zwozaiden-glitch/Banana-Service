import { SlashCommandBuilder } from 'discord.js';
import { TranslationService, SUPPORTED_LANGUAGES } from '../../services/translationService.js';
import { getGuildSettings } from '../../database/db.js';
import { createBananaEmbed, createErrorEmbed } from '../../utils/embeds.js';
import { getGuildEmoji } from '../../utils/emojis.js';

export default {
  data: new SlashCommandBuilder()
    .setName('translate')
    .setDescription('Translate text into French or other languages while preserving code & formatting')
    .addStringOption(opt =>
      opt.setName('text')
        .setDescription('The text you want to translate')
        .setRequired(true)
        .setMaxLength(2000)
    )
    .addStringOption(opt =>
      opt.setName('language')
        .setDescription('Target language (default: French)')
        .setRequired(false)
        .addChoices(
          ...SUPPORTED_LANGUAGES.map(l => ({ name: `${l.name} (${l.code})`, value: l.code }))
        )
    ),

  async execute(interaction) {
    const guildSettings = getGuildSettings(interaction.guild?.id);
    const text = interaction.options.getString('text');
    const targetLang = interaction.options.getString('language') || 'fr';

    await interaction.deferReply();

    try {
      const translated = await TranslationService.translateText(text, targetLang, 'auto');
      const langObj = SUPPORTED_LANGUAGES.find(l => l.code === targetLang) || { name: targetLang.toUpperCase() };

      const embed = createBananaEmbed(guildSettings, {
        title: `🌐 Translated to ${langObj.name}`,
        fields: [
          { name: 'Original', value: text.length > 1024 ? text.slice(0, 1021) + '...' : text },
          { name: 'Translation', value: translated.length > 1024 ? translated.slice(0, 1021) + '...' : translated },
        ],
        footerText: `Banana Service • Real-Time Translation (${langObj.name})`,
      });

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      return interaction.editReply({
        embeds: [createErrorEmbed(guildSettings, 'Translation Failed', err.message)],
      });
    }
  },
};
