import { SlashCommandBuilder } from 'discord.js';
import { getGuildSettings } from '../../database/db.js';
import { createBananaEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Display detailed profile and membership info about a user')
    .addUserOption(opt => opt.setName('user').setDescription('Target user (defaults to you)')),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild?.members.cache.get(targetUser.id);
    const guildSettings = getGuildSettings(interaction.guild?.id);

    const rolesList = member?.roles.cache
      .filter(r => r.id !== interaction.guild.id)
      .map(r => `<@&${r.id}>`)
      .slice(0, 10)
      .join(' ') || 'None';

    const embed = createBananaEmbed(guildSettings, {
      title: `👤 User Profile: ${targetUser.tag}`,
      fields: [
        { name: 'ID', value: `\`${targetUser.id}\``, inline: true },
        { name: 'Bot Account', value: targetUser.bot ? 'Yes' : 'No', inline: true },
        { name: 'Registered', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true },
        ...(member ? [
          { name: 'Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
          { name: 'Highest Role', value: `${member.roles.highest}`, inline: true },
          { name: 'Roles', value: rolesList, inline: false },
        ] : []),
      ],
      thumbnail: targetUser.displayAvatarURL({ dynamic: true, size: 256 }),
    });

    return interaction.reply({ embeds: [embed] });
  },
};
