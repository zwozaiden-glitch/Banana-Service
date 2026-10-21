import { SlashCommandBuilder } from 'discord.js';
import { getGuildSettings } from '../../database/db.js';
import { createBananaEmbed } from '../../utils/embeds.js';
import { getGuildEmoji } from '../../utils/emojis.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check Banana Service latency and Discord WebSocket heartbeat'),

  async execute(interaction) {
    const sent = await interaction.deferReply({ fetchReply: true });
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const wsPing = interaction.client.ws.ping;
    const guildSettings = getGuildSettings(interaction.guild?.id);
    const bananaRocket = getGuildEmoji(guildSettings, 'bananaRocket');

    const embed = createBananaEmbed(guildSettings, {
      title: `${bananaRocket} Pong! Banana Service Status`,
      fields: [
        { name: '⚡ Roundtrip Latency', value: `\`${roundtrip}ms\``, inline: true },
        { name: '💓 WebSocket Heartbeat', value: `\`${wsPing}ms\``, inline: true },
        { name: '🟢 Bot Status', value: '`Fully Operational`', inline: true },
      ],
      color: '#FFE135',
    });

    return interaction.editReply({ embeds: [embed] });
  },
};
