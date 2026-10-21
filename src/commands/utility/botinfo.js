import { AttachmentBuilder, SlashCommandBuilder } from 'discord.js';
import { getGuildSettings } from '../../database/db.js';
import { config } from '../../config.js';
import { createBananaEmbed } from '../../utils/embeds.js';
import os from 'node:os';

export default {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Display Banana Service system specs, memory, and bot details'),

  async execute(interaction) {
    const client = interaction.client;
    const guildSettings = getGuildSettings(interaction.guild?.id);

    const totalSeconds = process.uptime();
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const uptimeStr = `${days}d ${hours}h ${minutes}m`;

    const memoryUsageMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

    const embed = createBananaEmbed(guildSettings, {
      title: '🍌 Banana Service System Information',
      description: 'High-performance script management & server automation suite.',
      fields: [
        { name: '🤖 Bot Version', value: '`v1.0.0`', inline: true },
        { name: '🟢 Uptime', value: `\`${uptimeStr}\``, inline: true },
        { name: '💾 Memory Usage', value: `\`${memoryUsageMb} MB\``, inline: true },
        { name: '🌐 Servers', value: `\`${client.guilds.cache.size}\``, inline: true },
        { name: '👥 Cached Users', value: `\`${client.users.cache.size}\``, inline: true },
        { name: '⚡ Node.js', value: `\`${process.version}\``, inline: true },
        { name: '💻 Host Platform', value: `\`${os.type()} ${os.arch()}\``, inline: true },
        { name: '🛡️ Storage Engine', value: '`SQLite 3 (WAL Mode)`', inline: true },
      ],
      thumbnail: 'attachment://banana_service_logo.png',
      image: 'attachment://banana_service_banner.png',
    });

    const brandAssets = [
      new AttachmentBuilder(config.branding.avatarPath, { name: 'banana_service_logo.png' }),
      new AttachmentBuilder(config.branding.bannerPath, { name: 'banana_service_banner.png' }),
    ];

    return interaction.reply({ embeds: [embed], files: brandAssets });
  },
};
