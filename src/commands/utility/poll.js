import { SlashCommandBuilder } from 'discord.js';
import { getGuildSettings } from '../../database/db.js';
import { createBananaEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a community poll with up to 5 options')
    .addStringOption(opt => opt.setName('question').setDescription('Poll question').setRequired(true))
    .addStringOption(opt => opt.setName('option1').setDescription('First option').setRequired(true))
    .addStringOption(opt => opt.setName('option2').setDescription('Second option').setRequired(true))
    .addStringOption(opt => opt.setName('option3').setDescription('Third option'))
    .addStringOption(opt => opt.setName('option4').setDescription('Fourth option'))
    .addStringOption(opt => opt.setName('option5').setDescription('Fifth option')),

  async execute(interaction) {
    const guildSettings = getGuildSettings(interaction.guild?.id);
    const question = interaction.options.getString('question');

    const options = [
      interaction.options.getString('option1'),
      interaction.options.getString('option2'),
      interaction.options.getString('option3'),
      interaction.options.getString('option4'),
      interaction.options.getString('option5'),
    ].filter(Boolean);

    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

    const description = options
      .map((opt, i) => `${emojis[i]} **${opt}**`)
      .join('\n\n');

    const embed = createBananaEmbed(guildSettings, {
      title: `📊 Community Poll: ${question}`,
      description,
      footerText: `Poll created by ${interaction.user.tag} • React to vote!`,
    });

    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });

    for (let i = 0; i < options.length; i++) {
      await msg.react(emojis[i]).catch(() => {});
    }
  },
};
