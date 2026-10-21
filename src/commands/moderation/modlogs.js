import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getDatabase, getGuildSettings } from '../../database/db.js';
import { createBananaEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('modlogs')
    .setDescription('View recent moderation and audit log entries')
    .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
    .addIntegerOption(opt => opt.setName('limit').setDescription('Number of entries to show (max 20)').setMinValue(1).setMaxValue(20)),

  async execute(interaction) {
    const guildSettings = getGuildSettings(interaction.guild.id);
    const limit = interaction.options.getInteger('limit') || 10;
    const db = getDatabase();

    const logs = db.prepare(`
      SELECT * FROM audit_logs
      WHERE guild_id = ?
      ORDER BY id DESC
      LIMIT ?
    `).all(interaction.guild.id, limit);

    if (logs.length === 0) {
      return interaction.reply({
        content: 'No audit logs recorded for this server yet.',
        ephemeral: true,
      });
    }

    const fields = logs.map(l => ({
      name: `#${l.id} • ${l.action} (<t:${Math.floor(new Date(l.created_at).getTime() / 1000)}:R>)`,
      value: `**User:** <@${l.user_id}>\n${l.details ? `**Details:** \`${l.details.slice(0, 150)}\`` : ''}`,
      inline: false,
    }));

    const embed = createBananaEmbed(guildSettings, {
      title: '🛡️ Moderation & Audit History',
      fields,
    });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
