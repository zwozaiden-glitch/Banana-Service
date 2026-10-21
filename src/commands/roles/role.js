import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} from 'discord.js';
import { getDatabase, getGuildSettings } from '../../database/db.js';
import { BananaPermissions } from '../../utils/permissions.js';
import { createBananaEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embeds.js';
import { logAuditAction } from '../../utils/auditLogger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Banana Service Role Management')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Assign a role to a member')
        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to add').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a role from a member')
        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('View detailed information about a role')
        .addRoleOption(opt => opt.setName('role').setDescription('Role to inspect').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('autorole')
        .setDescription('Configure automatic roles given to members upon joining')
        .addStringOption(opt =>
          opt.setName('action')
            .setDescription('Add, remove, or list autoroles')
            .setRequired(true)
            .addChoices(
              { name: 'Add', value: 'add' },
              { name: 'Remove', value: 'remove' },
              { name: 'List', value: 'list' }
            )
        )
        .addRoleOption(opt => opt.setName('role').setDescription('Role to set as autorole'))
    )
    .addSubcommand(sub =>
      sub.setName('panel')
        .setDescription('Publish a self-assignable role button panel')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to post the role panel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption(opt => opt.setName('title').setDescription('Panel title').setRequired(true))
        .addRoleOption(opt => opt.setName('role1').setDescription('First role option').setRequired(true))
        .addRoleOption(opt => opt.setName('role2').setDescription('Second role option'))
        .addRoleOption(opt => opt.setName('role3').setDescription('Third role option'))
        .addRoleOption(opt => opt.setName('role4').setDescription('Fourth role option'))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const guildSettings = getGuildSettings(guild.id);
    const db = getDatabase();

    // 1. ADD ROLE
    if (subcommand === 'add') {
      const targetUser = interaction.options.getUser('user');
      const role = interaction.options.getRole('role');
      const member = guild.members.cache.get(targetUser.id);

      if (!member) {
        return interaction.reply({ embeds: [createErrorEmbed(guildSettings, 'Error', 'Member not found in server.')], ephemeral: true });
      }

      if (!BananaPermissions.canBotManageRole(guild, role)) {
        return interaction.reply({ embeds: [createErrorEmbed(guildSettings, 'Hierarchy Error', 'Bot cannot manage this role due to role hierarchy.')], ephemeral: true });
      }

      await member.roles.add(role);
      await logAuditAction(interaction.client, guild.id, {
        userId: interaction.user.id,
        action: 'ROLE_ADDED',
        targetType: 'User',
        targetId: member.id,
        details: { roleName: role.name, roleId: role.id },
      });

      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Role Added', `Assigned <@&${role.id}> to <@${member.id}>.`)],
      });
    }

    // 2. REMOVE ROLE
    if (subcommand === 'remove') {
      const targetUser = interaction.options.getUser('user');
      const role = interaction.options.getRole('role');
      const member = guild.members.cache.get(targetUser.id);

      if (!member) {
        return interaction.reply({ embeds: [createErrorEmbed(guildSettings, 'Error', 'Member not found.')], ephemeral: true });
      }

      if (!BananaPermissions.canBotManageRole(guild, role)) {
        return interaction.reply({ embeds: [createErrorEmbed(guildSettings, 'Hierarchy Error', 'Bot cannot manage this role due to role hierarchy.')], ephemeral: true });
      }

      await member.roles.remove(role);
      await logAuditAction(interaction.client, guild.id, {
        userId: interaction.user.id,
        action: 'ROLE_REMOVED',
        targetType: 'User',
        targetId: member.id,
        details: { roleName: role.name, roleId: role.id },
      });

      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Role Removed', `Removed <@&${role.id}> from <@${member.id}>.`)],
      });
    }

    // 3. ROLE INFO
    if (subcommand === 'info') {
      const role = interaction.options.getRole('role');
      const embed = createBananaEmbed(guildSettings, {
        title: `🏷️ Role Info: ${role.name}`,
        color: role.color ? role.hexColor : '#FFE135',
        fields: [
          { name: 'ID', value: `\`${role.id}\``, inline: true },
          { name: 'Position', value: `${role.position}`, inline: true },
          { name: 'Members', value: `${role.members.size}`, inline: true },
          { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
          { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
          { name: 'Color', value: `${role.hexColor}`, inline: true },
        ],
      });

      return interaction.reply({ embeds: [embed] });
    }

    // 4. AUTOROLE
    if (subcommand === 'autorole') {
      const action = interaction.options.getString('action');
      const role = interaction.options.getRole('role');

      if (action === 'list') {
        const rows = db.prepare('SELECT role_id FROM autoroles WHERE guild_id = ?').all(guild.id);
        const rolesList = rows.map(r => `<@&${r.role_id}>`).join('\n') || 'None configured.';
        const embed = createBananaEmbed(guildSettings, {
          title: 'Auto-Roles for New Members',
          description: rolesList,
        });
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (!role) {
        return interaction.reply({ embeds: [createErrorEmbed(guildSettings, 'Missing Role', 'Please specify a role.')], ephemeral: true });
      }

      if (action === 'add') {
        db.prepare('INSERT OR IGNORE INTO autoroles (guild_id, role_id) VALUES (?, ?)').run(guild.id, role.id);
        return interaction.reply({
          embeds: [createSuccessEmbed(guildSettings, 'Auto-Role Added', `New members will now automatically receive <@&${role.id}>.`)],
          ephemeral: true,
        });
      }

      if (action === 'remove') {
        db.prepare('DELETE FROM autoroles WHERE guild_id = ? AND role_id = ?').run(guild.id, role.id);
        return interaction.reply({
          embeds: [createSuccessEmbed(guildSettings, 'Auto-Role Removed', `<@&${role.id}> was removed from autoroles.`)],
          ephemeral: true,
        });
      }
    }

    // 5. ROLE PANEL
    if (subcommand === 'panel') {
      const channel = interaction.options.getChannel('channel');
      const title = interaction.options.getString('title');

      const roles = [
        interaction.options.getRole('role1'),
        interaction.options.getRole('role2'),
        interaction.options.getRole('role3'),
        interaction.options.getRole('role4'),
      ].filter(Boolean);

      const buttons = roles.map(r =>
        new ButtonBuilder()
          .setCustomId(`selfrole_${r.id}`)
          .setLabel(r.name)
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🍌')
      );

      const row = new ActionRowBuilder().addComponents(buttons);
      const embed = createBananaEmbed(guildSettings, {
        title: `🏷️ ${title}`,
        description: 'Click the buttons below to toggle your roles:',
        fields: roles.map(r => ({ name: r.name, value: `<@&${r.id}>`, inline: true })),
      });

      const msg = await channel.send({ embeds: [embed], components: [row] });

      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Role Panel Created', `Self-role panel is active in <#${channel.id}>.`)],
        ephemeral: true,
      });
    }
  },
};
