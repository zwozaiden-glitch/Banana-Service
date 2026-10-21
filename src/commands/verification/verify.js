import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { VerificationService } from '../../services/verificationService.js';
import { getDatabase, getGuildSettings } from '../../database/db.js';
import { createBananaEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embeds.js';
import { logAuditAction } from '../../utils/auditLogger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Banana Service Member Verification System')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Set up and publish the verification gate panel')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Verification channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addRoleOption(opt =>
          opt.setName('verified_role')
            .setDescription('Role given upon successful verification')
            .setRequired(true)
        )
        .addRoleOption(opt =>
          opt.setName('unverified_role')
            .setDescription('Role removed upon verification (optional)')
        )
        .addStringOption(opt =>
          opt.setName('challenge_type')
            .setDescription('Verification method')
            .addChoices(
              { name: 'Simple Button Click', value: 'button' },
              { name: 'Math Problem Challenge Modal', value: 'math' }
            )
        )
        .addStringOption(opt => opt.setName('instructions').setDescription('Custom message instructions'))
    )
    .addSubcommand(sub =>
      sub.setName('config')
        .setDescription('View current verification gate configuration')
    )
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Disable member verification gate')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const guildSettings = getGuildSettings(guild.id);
    const db = getDatabase();

    if (subcommand === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const verifiedRole = interaction.options.getRole('verified_role');
      const unverifiedRole = interaction.options.getRole('unverified_role');
      const challengeType = interaction.options.getString('challenge_type') || 'button';
      const instructions = interaction.options.getString('instructions') || 'Click the verify button below to gain access to the server!';

      const settings = {
        instructions,
        verified_role_id: verifiedRole.id,
        unverified_role_id: unverifiedRole?.id || null,
        challenge_type: challengeType,
        is_enabled: 1,
      };

      const payload = VerificationService.buildVerificationPanel(guildSettings, settings);
      const msg = await channel.send(payload);

      db.prepare(`
        INSERT INTO verification_settings (
          guild_id, channel_id, message_id, verified_role_id, unverified_role_id, challenge_type, instructions, is_enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(guild_id) DO UPDATE SET
          channel_id = excluded.channel_id,
          message_id = excluded.message_id,
          verified_role_id = excluded.verified_role_id,
          unverified_role_id = excluded.unverified_role_id,
          challenge_type = excluded.challenge_type,
          instructions = excluded.instructions,
          is_enabled = 1
      `).run(
        guild.id,
        channel.id,
        msg.id,
        verifiedRole.id,
        unverifiedRole?.id || null,
        challengeType,
        instructions
      );

      await logAuditAction(interaction.client, guild.id, {
        userId: interaction.user.id,
        action: 'VERIFY_SETUP',
        details: { channelId: channel.id, verifiedRole: verifiedRole.name, challengeType },
      });

      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Verification Deployed', `Verification gate published in <#${channel.id}>!`)],
        ephemeral: true,
      });
    }

    if (subcommand === 'config') {
      const cfg = VerificationService.getSettings(guild.id);
      const embed = createBananaEmbed(guildSettings, {
        title: 'Verification System Config',
        fields: [
          { name: 'Status', value: cfg.is_enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
          { name: 'Channel', value: cfg.channel_id ? `<#${cfg.channel_id}>` : 'None', inline: true },
          { name: 'Verified Role', value: cfg.verified_role_id ? `<@&${cfg.verified_role_id}>` : 'None', inline: true },
          { name: 'Unverified Role', value: cfg.unverified_role_id ? `<@&${cfg.unverified_role_id}>` : 'None', inline: true },
          { name: 'Challenge Type', value: cfg.challenge_type || 'button', inline: true },
        ],
      });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'disable') {
      db.prepare('UPDATE verification_settings SET is_enabled = 0 WHERE guild_id = ?').run(guild.id);
      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Verification Disabled', 'Verification gate has been deactivated.')],
        ephemeral: true,
      });
    }
  },
};
