import { SlashCommandBuilder } from 'discord.js';
import { getGuildSettings } from '../../database/db.js';
import { createBananaEmbed } from '../../utils/embeds.js';
import { getGuildEmoji } from '../../utils/emojis.js';

export default {
  data: new SlashCommandBuilder()
    .setName('uptime')
    .setDescription('Check how long Banana Service has been running smoothly'),

  async execute(interaction) {
    const guildSettings = getGuildSettings(interaction.guild?.id);
    const totalSeconds = process.uptime();
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const banana = getGuildEmoji(guildSettings, 'banana');
    const embed = createBananaEmbed(guildSettings, {
      title: `${banana} Banana Service Uptime`,
      description: `🍌 Bot has been active for **${days}d ${hours}h ${minutes}m ${seconds}s** without interruption.`,
      fields: [
        { name: 'Started At', value: `<t:${Math.floor((Date.now() - totalSeconds * 1000) / 1000)}:f>`, inline: true },
        { name: 'Process Memory', value: `\`${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB\``, inline: true },
      ],
    });

    return interaction.reply({ embeds: [embed] });
  },
};
