import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getGuildSettings } from '../../database/db.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode cooldown for the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(opt =>
      opt.setName('seconds')
        .setDescription('Cooldown in seconds (0 to disable)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600)
    ),

  async execute(interaction) {
    const guildSettings = getGuildSettings(interaction.guild.id);
    const seconds = interaction.options.getInteger('seconds');

    try {
      await interaction.channel.setRateLimitPerUser(seconds);
      const text = seconds === 0
        ? 'Slowmode has been disabled.'
        : `Slowmode set to **${seconds} second(s)**.`;

      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Slowmode Updated', text)],
      });
    } catch (err) {
      return interaction.reply({
        embeds: [createErrorEmbed(guildSettings, 'Slowmode Error', err.message)],
        ephemeral: true,
      });
    }
  },
};
