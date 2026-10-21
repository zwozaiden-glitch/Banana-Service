import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getDatabase, getGuildSettings } from '../../database/db.js';
import { createBananaEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('customcmd')
    .setDescription('Create simple custom server commands without code execution')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Create a custom text command (e.g. !rules, !links)')
        .addStringOption(opt => opt.setName('name').setDescription('Command name (e.g. rules, website)').setRequired(true))
        .addStringOption(opt => opt.setName('reply').setDescription('Message the command sends').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all custom text commands')
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Delete a custom command')
        .addStringOption(opt => opt.setName('name').setDescription('Command name to delete').setRequired(true))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const guildSettings = getGuildSettings(guild.id);
    const db = getDatabase();

    if (subcommand === 'add') {
      const name = interaction.options.getString('name').toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const reply = interaction.options.getString('reply').trim();

      const stmt = db.prepare(`
        INSERT INTO custom_commands (guild_id, command_name, response_text, created_by)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(guild_id, command_name) DO UPDATE SET
          response_text = excluded.response_text
      `);

      stmt.run(guild.id, name, reply, interaction.user.id);

      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Custom Command Created', `Created command **!${name}**! Members can invoke it via chat text.`)],
        ephemeral: true,
      });
    }

    if (subcommand === 'list') {
      const rows = db.prepare('SELECT * FROM custom_commands WHERE guild_id = ?').all(guild.id);
      if (rows.length === 0) {
        return interaction.reply({ embeds: [createBananaEmbed(guildSettings, { title: 'Custom Commands', description: 'No custom commands created yet. Use `/customcmd add`!' })], ephemeral: true });
      }

      const fields = rows.map(r => ({
        name: `!${r.command_name}`,
        value: r.response_text.slice(0, 100),
        inline: true,
      }));

      return interaction.reply({ embeds: [createBananaEmbed(guildSettings, { title: 'Custom Commands', fields })], ephemeral: true });
    }

    if (subcommand === 'remove') {
      const name = interaction.options.getString('name').toLowerCase();
      const info = db.prepare('DELETE FROM custom_commands WHERE guild_id = ? AND command_name = ?').run(guild.id, name);

      if (info.changes === 0) {
        return interaction.reply({ embeds: [createErrorEmbed(guildSettings, 'Not Found', `Command !${name} not found.`)], ephemeral: true });
      }

      return interaction.reply({ embeds: [createSuccessEmbed(guildSettings, 'Command Removed', `Command !${name} was deleted.`)], ephemeral: true });
    }
  },
};
