import { SlashCommandBuilder } from 'discord.js';
import { getGuildSettings } from '../../database/db.js';
import { createBananaEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Display the high-resolution avatar of a user')
    .addUserOption(opt => opt.setName('user').setDescription('Target user')),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const guildSettings = getGuildSettings(interaction.guild?.id);
    const avatarUrl = targetUser.displayAvatarURL({ dynamic: true, size: 1024 });

    const embed = createBananaEmbed(guildSettings, {
      title: `🍌 Avatar of ${targetUser.username}`,
      image: avatarUrl,
      fields: [
        { name: 'Download Links', value: `[Direct Link](${avatarUrl})` },
      ],
    });

    return interaction.reply({ embeds: [embed] });
  },
};
