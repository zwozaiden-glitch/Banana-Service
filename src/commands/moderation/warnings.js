import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { ModerationService } from '../../services/moderationService.js';
import { getGuildSettings } from '../../database/db.js';
import { createBananaEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View moderation warnings for a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true)),

  async execute(interaction) {
    const guildSettings = getGuildSettings(interaction.guild.id);
    const targetUser = interaction.options.getUser('user');

    const warnings = ModerationService.getWarnings(interaction.guild.id, targetUser.id);

    if (warnings.length === 0) {
      return interaction.reply({
        content: `✅ **${targetUser.tag}** has a clean record with 0 warnings.`,
        ephemeral: true,
      });
    }

    const fields = warnings.map((w, index) => ({
      name: `#${index + 1} • ${new Date(w.created_at).toLocaleDateString()}`,
      value: `**Reason:** ${w.reason}\n**Moderator:** <@${w.moderator_id}>`,
      inline: false,
    }));

    const embed = createBananaEmbed(guildSettings, {
      title: `⚠️ Warnings for ${targetUser.tag} (${warnings.length})`,
      fields,
      color: '#F59E0B',
    });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
