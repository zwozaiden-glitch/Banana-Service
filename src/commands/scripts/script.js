import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} from 'discord.js';
import { ScriptService } from '../../services/scriptService.js';
import { AnnouncementService } from '../../services/announcementService.js';
import { getGuildSettings } from '../../database/db.js';
import { BananaPermissions } from '../../utils/permissions.js';
import { createBananaEmbed, createSuccessEmbed, createErrorEmbed, createPaginationRow } from '../../utils/embeds.js';
import { getGuildEmoji } from '../../utils/emojis.js';
import { logAuditAction } from '../../utils/auditLogger.js';
import fs from 'node:fs';

export default {
  data: new SlashCommandBuilder()
    .setName('script')
    .setDescription('Banana Service Script Management Suite')
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all stored scripts in the server repository')
        .addStringOption(opt => opt.setName('category').setDescription('Filter by category'))
        .addStringOption(opt => opt.setName('search').setDescription('Search by name or keyword'))
        .addIntegerOption(opt => opt.setName('page').setDescription('Page number').setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('View detailed script metadata, author, and version history')
        .addStringOption(opt => opt.setName('name_or_id').setDescription('Script name, slug, or ID').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('upload')
        .setDescription('Upload a new script file (.lua, .txt, etc.)')
        .addAttachmentOption(opt => opt.setName('file').setDescription('The script file to upload').setRequired(true))
        .addStringOption(opt => opt.setName('name').setDescription('Display name of the script').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('Short description of what the script does'))
        .addStringOption(opt => opt.setName('category').setDescription('Script category (e.g. Utility, Admin, Combat)'))
        .addStringOption(opt => opt.setName('version').setDescription('Version string (e.g. 1.0.0)'))
        .addRoleOption(opt => opt.setName('access_role').setDescription('Role required to download (optional)'))
        .addBooleanOption(opt => opt.setName('private').setDescription('Restrict access to authorized roles only'))
    )
    .addSubcommand(sub =>
      sub.setName('update')
        .setDescription('Update an existing script with a new version file')
        .addStringOption(opt => opt.setName('name_or_id').setDescription('Existing script name or ID').setRequired(true))
        .addAttachmentOption(opt => opt.setName('file').setDescription('New script file').setRequired(true))
        .addStringOption(opt => opt.setName('version').setDescription('New version string (e.g. 1.1.0)').setRequired(true))
        .addStringOption(opt => opt.setName('changelog').setDescription('Summary of changes in this release'))
    )
    .addSubcommand(sub =>
      sub.setName('download')
        .setDescription('Download a script file directly')
        .addStringOption(opt => opt.setName('name_or_id').setDescription('Script name or ID').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Permanently delete a script and all version files')
        .addStringOption(opt => opt.setName('name_or_id').setDescription('Script name or ID').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('versions')
        .setDescription('View all historical versions of a script')
        .addStringOption(opt => opt.setName('name_or_id').setDescription('Script name or ID').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('rollback')
        .setDescription('Rollback a script to a previous version')
        .addStringOption(opt => opt.setName('name_or_id').setDescription('Script name or ID').setRequired(true))
        .addStringOption(opt => opt.setName('version').setDescription('Target version to restore').setRequired(true))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const guildSettings = getGuildSettings(guildId);

    // 1. LIST
    if (subcommand === 'list') {
      const category = interaction.options.getString('category');
      const search = interaction.options.getString('search');
      const page = interaction.options.getInteger('page') || 1;

      const { items, total, totalPages } = ScriptService.listScripts(guildId, {
        category,
        search,
        page,
        limit: 6,
      });

      if (items.length === 0) {
        return interaction.reply({
          embeds: [
            createBananaEmbed(guildSettings, {
              title: 'Script Repository',
              description: 'No scripts found matching your query.\nUpload one using `/script upload` or `/setscript`!',
            }),
          ],
          ephemeral: true,
        });
      }

      const scriptFields = items.map(s => ({
        name: `📦 ${s.name} (v${s.version})`,
        value: `**Category:** \`${s.category}\` • **Downloads:** \`${s.download_count}\`\n**File:** \`${s.original_filename}\` (${(s.file_size / 1024).toFixed(1)} KB)\n${s.description ? s.description.slice(0, 100) : 'No description.'}`,
        inline: false,
      }));

      const embed = createBananaEmbed(guildSettings, {
        title: '🍌 Banana Service — Script Repository',
        description: `Found **${total}** script(s)${category ? ` in category **${category}**` : ''}${search ? ` matching **"${search}"**` : ''}.\nPage ${page} of ${totalPages}`,
        fields: scriptFields,
      });

      const components = totalPages > 1 ? [createPaginationRow(page, totalPages, 'script_page')] : [];
      return interaction.reply({ embeds: [embed], components });
    }

    // 2. INFO
    if (subcommand === 'info') {
      const nameOrId = interaction.options.getString('name_or_id');
      const script = ScriptService.getScript(guildId, nameOrId);

      if (!script) {
        return interaction.reply({
          embeds: [createErrorEmbed(guildSettings, 'Not Found', `Script "${nameOrId}" does not exist.`)],
          ephemeral: true,
        });
      }

      const versions = ScriptService.getVersions(script.id);
      const accessText = script.is_private
        ? (script.access_role_id ? `<@&${script.access_role_id}> only` : 'Private (Staff only)')
        : 'Public (Everyone)';

      const embed = createBananaEmbed(guildSettings, {
        title: `📜 Script Info: ${script.name}`,
        fields: [
          { name: '🔖 Current Version', value: `\`v${script.version}\``, inline: true },
          { name: '📁 Category', value: `\`${script.category}\``, inline: true },
          { name: '📥 Total Downloads', value: `\`${script.download_count}\``, inline: true },
          { name: '👤 Uploader', value: `<@${script.uploader_id}>`, inline: true },
          { name: '🔒 Access', value: accessText, inline: true },
          { name: '📦 Stored File', value: `\`${script.original_filename}\` (${(script.file_size / 1024).toFixed(1)} KB)`, inline: true },
          { name: '📝 Description', value: script.description || 'None provided.', inline: false },
          { name: '🕰️ Version History', value: versions.map(v => `• **v${v.version}** (${new Date(v.created_at).toLocaleDateString()}) - ${v.changelog || 'No log'}`).slice(0, 5).join('\n') || 'None', inline: false },
        ],
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`script_dl_${script.id}`)
          .setLabel(`Download v${script.version}`)
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📥')
      );

      return interaction.reply({ embeds: [embed], components: [row] });
    }

    // 3. UPLOAD
    if (subcommand === 'upload') {
      if (!BananaPermissions.canManageScripts(interaction.member, guildSettings)) {
        return interaction.reply({
          embeds: [createErrorEmbed(guildSettings, 'Permission Denied', 'You do not have permission to upload scripts.')],
          ephemeral: true,
        });
      }

      await interaction.deferReply();

      const attachment = interaction.options.getAttachment('file');
      const name = interaction.options.getString('name');
      const description = interaction.options.getString('description') || '';
      const category = interaction.options.getString('category') || 'General';
      const version = interaction.options.getString('version') || '1.0.0';
      const accessRole = interaction.options.getRole('access_role');
      const isPrivate = interaction.options.getBoolean('private') || false;

      try {
        const response = await fetch(attachment.url);
        if (!response.ok) throw new Error('Failed to download attached file from Discord.');
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const created = await ScriptService.uploadScript({
          guildId,
          name,
          description,
          category,
          version,
          originalFilename: attachment.name,
          buffer,
          uploaderId: interaction.user.id,
          uploaderTag: interaction.user.tag,
          accessRoleId: accessRole?.id || null,
          isPrivate,
        });

        await logAuditAction(interaction.client, guildId, {
          userId: interaction.user.id,
          action: 'SCRIPT_UPLOAD',
          targetType: 'Script',
          targetId: created.id,
          details: { name: created.name, version: created.version, file: created.original_filename },
        });

        // Trigger automatic update announcement if configured
        await AnnouncementService.announceScriptChange(interaction.client, guildId, created, true);

        const embed = createSuccessEmbed(
          guildSettings,
          'Script Uploaded Successfully',
          `Script **${created.name}** (v${created.version}) has been safely validated and stored in **Banana Service**!`
        );

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({
          embeds: [createErrorEmbed(guildSettings, 'Upload Failed', err.message)],
        });
      }
    }

    // 4. UPDATE
    if (subcommand === 'update') {
      if (!BananaPermissions.canManageScripts(interaction.member, guildSettings)) {
        return interaction.reply({
          embeds: [createErrorEmbed(guildSettings, 'Permission Denied', 'You do not have permission to update scripts.')],
          ephemeral: true,
        });
      }

      await interaction.deferReply();

      const nameOrId = interaction.options.getString('name_or_id');
      const attachment = interaction.options.getAttachment('file');
      const version = interaction.options.getString('version');
      const changelog = interaction.options.getString('changelog') || 'Version update';

      try {
        const response = await fetch(attachment.url);
        if (!response.ok) throw new Error('Failed to fetch attached file.');
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const updated = await ScriptService.updateScript({
          guildId,
          scriptIdOrSlug: nameOrId,
          version,
          changelog,
          originalFilename: attachment.name,
          buffer,
          uploaderId: interaction.user.id,
        });

        await logAuditAction(interaction.client, guildId, {
          userId: interaction.user.id,
          action: 'SCRIPT_UPDATE',
          targetType: 'Script',
          targetId: updated.id,
          details: { name: updated.name, newVersion: updated.version, changelog },
        });

        // Trigger automatic update announcement
        await AnnouncementService.announceScriptChange(interaction.client, guildId, updated, false, changelog);

        const embed = createSuccessEmbed(
          guildSettings,
          'Script Updated',
          `Script **${updated.name}** updated to **v${updated.version}**!`
        );

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({
          embeds: [createErrorEmbed(guildSettings, 'Update Failed', err.message)],
        });
      }
    }

    // 5. DOWNLOAD
    if (subcommand === 'download') {
      const nameOrId = interaction.options.getString('name_or_id');
      const script = ScriptService.getScript(guildId, nameOrId);

      if (!script) {
        return interaction.reply({
          embeds: [createErrorEmbed(guildSettings, 'Not Found', `Script "${nameOrId}" does not exist.`)],
          ephemeral: true,
        });
      }

      if (!BananaPermissions.canAccessScript(interaction.member, script, guildSettings)) {
        return interaction.reply({
          embeds: [createErrorEmbed(guildSettings, 'Access Denied', 'You do not have the required role to download this script.')],
          ephemeral: true,
        });
      }

      if (!fs.existsSync(script.current_filename)) {
        return interaction.reply({
          embeds: [createErrorEmbed(guildSettings, 'File Error', 'Script file is missing on storage host.')],
          ephemeral: true,
        });
      }

      ScriptService.recordDownload(script.id);
      const attachment = new AttachmentBuilder(script.current_filename, { name: script.original_filename });

      return interaction.reply({
        content: `🍌 Here is your download for **${script.name}** (v${script.version}):`,
        files: [attachment],
        ephemeral: true,
      });
    }

    // 6. DELETE
    if (subcommand === 'delete') {
      if (!BananaPermissions.canManageScripts(interaction.member, guildSettings)) {
        return interaction.reply({
          embeds: [createErrorEmbed(guildSettings, 'Permission Denied', 'You do not have permission to delete scripts.')],
          ephemeral: true,
        });
      }

      const nameOrId = interaction.options.getString('name_or_id');
      try {
        const deleted = ScriptService.deleteScript(guildId, nameOrId);
        await logAuditAction(interaction.client, guildId, {
          userId: interaction.user.id,
          action: 'SCRIPT_DELETE',
          targetType: 'Script',
          targetId: deleted.id,
          details: { name: deleted.name },
        });

        return interaction.reply({
          embeds: [createSuccessEmbed(guildSettings, 'Script Deleted', `Script **${deleted.name}** was permanently removed.`)],
        });
      } catch (err) {
        return interaction.reply({
          embeds: [createErrorEmbed(guildSettings, 'Delete Failed', err.message)],
          ephemeral: true,
        });
      }
    }

    // 7. VERSIONS
    if (subcommand === 'versions') {
      const nameOrId = interaction.options.getString('name_or_id');
      const script = ScriptService.getScript(guildId, nameOrId);

      if (!script) {
        return interaction.reply({
          embeds: [createErrorEmbed(guildSettings, 'Not Found', `Script "${nameOrId}" does not exist.`)],
          ephemeral: true,
        });
      }

      const versions = ScriptService.getVersions(script.id);
      const fields = versions.map(v => ({
        name: `Version ${v.version} • ${new Date(v.created_at).toLocaleDateString()}`,
        value: `**File:** \`${v.original_filename}\` (${(v.file_size / 1024).toFixed(1)} KB)\n**Uploader:** <@${v.uploader_id}>\n**Changelog:** ${v.changelog || 'None'}`,
        inline: false,
      }));

      const embed = createBananaEmbed(guildSettings, {
        title: `Version History: ${script.name}`,
        description: `Current Active Version: **v${script.version}**`,
        fields,
      });

      return interaction.reply({ embeds: [embed] });
    }

    // 8. ROLLBACK
    if (subcommand === 'rollback') {
      if (!BananaPermissions.canManageScripts(interaction.member, guildSettings)) {
        return interaction.reply({
          embeds: [createErrorEmbed(guildSettings, 'Permission Denied', 'You do not have permission to rollback scripts.')],
          ephemeral: true,
        });
      }

      const nameOrId = interaction.options.getString('name_or_id');
      const targetVersion = interaction.options.getString('version');

      try {
        const restored = ScriptService.rollbackVersion(guildId, nameOrId, targetVersion);
        await logAuditAction(interaction.client, guildId, {
          userId: interaction.user.id,
          action: 'SCRIPT_ROLLBACK',
          targetType: 'Script',
          targetId: restored.id,
          details: { name: restored.name, restoredVersion: targetVersion },
        });

        return interaction.reply({
          embeds: [createSuccessEmbed(guildSettings, 'Rollback Complete', `Script **${restored.name}** has been restored to **v${restored.version}**!`)],
        });
      } catch (err) {
        return interaction.reply({
          embeds: [createErrorEmbed(guildSettings, 'Rollback Failed', err.message)],
          ephemeral: true,
        });
      }
    }
  },
};
