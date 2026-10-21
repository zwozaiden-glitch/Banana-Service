import { SlashCommandBuilder } from 'discord.js';
import { getGuildSettings } from '../../database/db.js';
import { createBananaEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Display information about this Discord server'),

  async execute(interaction) {
    const guild = interaction.guild;
    const guildSettings = getGuildSettings(guild.id);
    const owner = await guild.fetchOwner().catch(() => null);

    const embed = createBananaEmbed(guildSettings, {
      title: `📊 ${guild.name} Server Overview`,
      fields: [
        { name: 'Server ID', value: `\`${guild.id}\``, inline: true },
        { name: 'Owner', value: owner ? `<@${owner.id}>` : 'Unknown', inline: true },
        { name: 'Created At', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: 'Members', value: `\`${guild.memberCount}\``, inline: true },
        { name: 'Channels', value: `\`${guild.channels.cache.size}\``, inline: true },
        { name: 'Roles', value: `\`${guild.roles.cache.size}\``, inline: true },
        { name: 'Boost Level', value: `Level \`${guild.premiumTier}\` (${guild.premiumSubscriptionCount || 0} boosts)`, inline: true },
      ],
      thumbnail: guild.iconURL({ dynamic: true, size: 256 }),
    });

    return interaction.reply({ embeds: [embed] });
  },
};
