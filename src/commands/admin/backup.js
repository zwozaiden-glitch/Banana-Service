import { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config.js';
import { getDatabase, getGuildSettings } from '../../database/db.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds.js';
import { ensureDirectoryExists } from '../../utils/fileValidator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Export a snapshot backup of the Banana Service database')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const guildSettings = getGuildSettings(interaction.guild?.id);

    await interaction.deferReply({ ephemeral: true });

    try {
      const db = getDatabase();
      ensureDirectoryExists(config.storage.backupsDir);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFilename = `banana_backup_${timestamp}.db`;
      const backupPath = path.join(config.storage.backupsDir, backupFilename);

      // better-sqlite3 native safe online backup
      await db.backup(backupPath);

      const attachment = new AttachmentBuilder(backupPath, { name: backupFilename });

      return interaction.editReply({
        embeds: [createSuccessEmbed(guildSettings, 'Database Backup Created', `Full database backup completed: \`${backupFilename}\``)],
        files: [attachment],
      });
    } catch (err) {
      return interaction.editReply({
        embeds: [createErrorEmbed(guildSettings, 'Backup Failed', err.message)],
      });
    }
  },
};
