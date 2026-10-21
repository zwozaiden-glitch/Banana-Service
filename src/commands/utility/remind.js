import { SlashCommandBuilder } from 'discord.js';
import { getGuildSettings } from '../../database/db.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds.js';

function parseDuration(str) {
  const match = str.match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    case 'd': return num * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set a personal reminder')
    .addStringOption(opt => opt.setName('time').setDescription('When to remind you (e.g. 10m, 2h, 1d)').setRequired(true))
    .addStringOption(opt => opt.setName('reminder').setDescription('What you want to be reminded about').setRequired(true)),

  async execute(interaction) {
    const guildSettings = getGuildSettings(interaction.guild?.id);
    const timeStr = interaction.options.getString('time');
    const reminder = interaction.options.getString('reminder');
    const durationMs = parseDuration(timeStr);

    if (!durationMs) {
      return interaction.reply({
        embeds: [createErrorEmbed(guildSettings, 'Invalid Time', 'Please use a format like `10m`, `2h`, or `1d`.')],
        ephemeral: true,
      });
    }

    const remindAt = Math.floor((Date.now() + durationMs) / 1000);

    setTimeout(async () => {
      try {
        await interaction.user.send({
          content: `⏰ **Banana Service Reminder:** ${reminder}\n(Set <t:${Math.floor(Date.now() / 1000)}:R>)`,
        });
      } catch {
        // Fallback to channel if DMs are closed
        await interaction.channel?.send({
          content: `<@${interaction.user.id}> ⏰ **Reminder:** ${reminder}`,
        }).catch(() => {});
      }
    }, durationMs);

    return interaction.reply({
      embeds: [createSuccessEmbed(guildSettings, 'Reminder Set', `I will remind you about "**${reminder}**" in <t:${remindAt}:R>!`)],
      ephemeral: true,
    });
  },
};
