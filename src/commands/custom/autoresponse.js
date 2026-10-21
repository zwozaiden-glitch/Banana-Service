import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getDatabase, getGuildSettings } from '../../database/db.js';
import { createBananaEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('autoresponse')
    .setDescription('Configure automated keyword responses')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a new auto-response trigger')
        .addStringOption(opt => opt.setName('trigger').setDescription('Phrase that triggers response').setRequired(true))
        .addStringOption(opt => opt.setName('response').setDescription('Bot reply text').setRequired(true))
        .addStringOption(opt =>
          opt.setName('match_type')
            .setDescription('Matching logic')
            .addChoices(
              { name: 'Contains Keyword', value: 'contains' },
              { name: 'Exact Match', value: 'exact' }
            )
        )
        .addIntegerOption(opt => opt.setName('cooldown').setDescription('Cooldown in seconds (default: 5)').setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all configured auto-responses')
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Delete an auto-response')
        .addIntegerOption(opt => opt.setName('id').setDescription('Auto-response ID to delete').setRequired(true))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const guildSettings = getGuildSettings(guild.id);
    const db = getDatabase();

    if (subcommand === 'add') {
      const trigger = interaction.options.getString('trigger').toLowerCase().trim();
      const response = interaction.options.getString('response').trim();
      const matchType = interaction.options.getString('match_type') || 'contains';
      const cooldown = interaction.options.getInteger('cooldown') || 5;

      const stmt = db.prepare(`
        INSERT INTO auto_responses (guild_id, trigger_phrase, response_text, match_type, cooldown_seconds, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const info = stmt.run(guild.id, trigger, response, matchType, cooldown, interaction.user.id);

      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Auto-Response Added', `Created trigger **"${trigger}"** (#${info.lastInsertRowid})!`)],
        ephemeral: true,
      });
    }

    if (subcommand === 'list') {
      const rows = db.prepare('SELECT * FROM auto_responses WHERE guild_id = ?').all(guild.id);
      if (rows.length === 0) {
        return interaction.reply({ embeds: [createBananaEmbed(guildSettings, { title: 'Auto-Responses', description: 'No auto-responses configured.' })], ephemeral: true });
      }

      const fields = rows.map(r => ({
        name: `#${r.id} • Trigger: "${r.trigger_phrase}" (${r.match_type})`,
        value: `Reply: ${r.response_text.slice(0, 100)}\nCooldown: ${r.cooldown_seconds}s`,
        inline: false,
      }));

      return interaction.reply({ embeds: [createBananaEmbed(guildSettings, { title: 'Configured Auto-Responses', fields })], ephemeral: true });
    }

    if (subcommand === 'remove') {
      const id = interaction.options.getInteger('id');
      const info = db.prepare('DELETE FROM auto_responses WHERE id = ? AND guild_id = ?').run(id, guild.id);

      if (info.changes === 0) {
        return interaction.reply({ embeds: [createErrorEmbed(guildSettings, 'Not Found', `Auto-response #${id} not found.`)], ephemeral: true });
      }

      return interaction.reply({ embeds: [createSuccessEmbed(guildSettings, 'Removed', `Auto-response #${id} deleted.`)], ephemeral: true });
    }
  },
};
