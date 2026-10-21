import { SlashCommandBuilder } from 'discord.js';
import { ScriptService } from '../../services/scriptService.js';
import { AnnouncementService } from '../../services/announcementService.js';
import { getGuildSettings } from '../../database/db.js';
import { BananaPermissions } from '../../utils/permissions.js';
import { createBananaEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embeds.js';
import { logAuditAction } from '../../utils/auditLogger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setscript')
    .setDescription('Quickly configure or upload a script for a specific channel or role')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Script name (new or existing)')
        .setRequired(true)
    )
    .addAttachmentOption(opt =>
      opt.setName('file')
        .setDescription('Upload script file (.lua, .txt, etc.)')
    )
    .addStringOption(opt =>
      opt.setName('category')
        .setDescription('Script category (e.g., Utility, Automation, Lua)')
    )
    .addStringOption(opt =>
      opt.setName('version')
        .setDescription('Version string (e.g. 1.0.0)')
    )
    .addStringOption(opt =>
      opt.setName('description')
        .setDescription('Purpose and usage instructions')
    )
    .addRoleOption(opt =>
      opt.setName('access_role')
        .setDescription('Required role to access/download')
    )
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel associated with this script')
    )
    .addBooleanOption(opt =>
      opt.setName('private')
        .setDescription('Make this script private to authorized roles')
    ),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const guildSettings = getGuildSettings(guildId);

    if (!BananaPermissions.canManageScripts(interaction.member, guildSettings)) {
      return interaction.reply({
        embeds: [createErrorEmbed(guildSettings, 'Permission Denied', 'You do not have permission to configure scripts.')],
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const name = interaction.options.getString('name');
    const file = interaction.options.getAttachment('file');
    const category = interaction.options.getString('category');
    const version = interaction.options.getString('version');
    const description = interaction.options.getString('description');
    const accessRole = interaction.options.getRole('access_role');
    const channel = interaction.options.getChannel('channel');
    const isPrivate = interaction.options.getBoolean('private');

    try {
      const existing = ScriptService.getScript(guildId, name);

      let scriptResult;
      let isNew = false;

      if (!existing) {
        // Must upload a file when creating new script
        if (!file) {
          return interaction.editReply({
            embeds: [
              createErrorEmbed(
                guildSettings,
                'File Required',
                `Script "${name}" does not exist yet. Please attach a valid script file (.lua, .txt, etc.) to create it.`
              ),
            ],
          });
        }

        const res = await fetch(file.url);
        if (!res.ok) throw new Error('Failed to retrieve file from Discord.');
        const buffer = Buffer.from(await res.arrayBuffer());

        scriptResult = await ScriptService.uploadScript({
          guildId,
          name,
          description: description || 'Configured via /setscript',
          category: category || 'General',
          version: version || '1.0.0',
          originalFilename: file.name,
          buffer,
          uploaderId: interaction.user.id,
          uploaderTag: interaction.user.tag,
          accessRoleId: accessRole?.id || null,
          targetChannelId: channel?.id || null,
          isPrivate: isPrivate ?? false,
        });

        isNew = true;
      } else {
        // Updating existing script
        if (file) {
          const res = await fetch(file.url);
          if (!res.ok) throw new Error('Failed to retrieve file from Discord.');
          const buffer = Buffer.from(await res.arrayBuffer());

          await ScriptService.updateScript({
            guildId,
            scriptIdOrSlug: existing.id,
            version: version || existing.version,
            changelog: description || 'Configured via /setscript',
            originalFilename: file.name,
            buffer,
            uploaderId: interaction.user.id,
          });
        }

        const updateFields = {};
        if (category) updateFields.category = category;
        if (description) updateFields.description = description;
        if (accessRole) updateFields.access_role_id = accessRole.id;
        if (channel) updateFields.target_channel_id = channel.id;
        if (isPrivate !== null) updateFields.is_private = isPrivate;

        scriptResult = ScriptService.updateMetadata(guildId, existing.id, updateFields);
      }

      await logAuditAction(interaction.client, guildId, {
        userId: interaction.user.id,
        action: isNew ? 'SETSCRIPT_CREATE' : 'SETSCRIPT_UPDATE',
        targetType: 'Script',
        targetId: scriptResult.id,
        details: { name: scriptResult.name, category: scriptResult.category, file: scriptResult.original_filename },
      });

      // Send update announcement if enabled
      await AnnouncementService.announceScriptChange(interaction.client, guildId, scriptResult, isNew);

      const embed = createBananaEmbed(guildSettings, {
        title: `🍌 Script Configured: ${scriptResult.name}`,
        description: `The script has been successfully ${isNew ? 'registered' : 'updated'} in **Banana Service**!`,
        fields: [
          { name: '🔖 Version', value: `\`v${scriptResult.version}\``, inline: true },
          { name: '📁 Category', value: `\`${scriptResult.category}\``, inline: true },
          { name: '📦 File', value: `\`${scriptResult.original_filename}\``, inline: true },
          { name: '🔒 Access Role', value: scriptResult.access_role_id ? `<@&${scriptResult.access_role_id}>` : 'Public', inline: true },
          { name: '🎯 Bound Channel', value: scriptResult.target_channel_id ? `<#${scriptResult.target_channel_id}>` : 'None', inline: true },
          { name: '📝 Description', value: scriptResult.description || 'None', inline: false },
        ],
        color: '#10B981',
      });

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      return interaction.editReply({
        embeds: [createErrorEmbed(guildSettings, 'Configuration Failed', err.message)],
      });
    }
  },
};
