import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { GiveawayService } from '../../services/giveawayService.js';
import { getDatabase, getGuildSettings } from '../../database/db.js';
import { createBananaEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embeds.js';
import { logAuditAction } from '../../utils/auditLogger.js';

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
    .setName('giveaway')
    .setDescription('Banana Service Giveaway Management')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create and launch a new giveaway')
        .addStringOption(opt => opt.setName('prize').setDescription('Giveaway prize').setRequired(true))
        .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 10m, 2h, 1d)').setRequired(true))
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to host giveaway')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
        .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners (default: 1)').setMinValue(1))
        .addRoleOption(opt => opt.setName('required_role').setDescription('Role requirement to enter'))
        .addIntegerOption(opt => opt.setName('min_account_age_days').setDescription('Minimum Discord account age in days'))
        .addStringOption(opt => opt.setName('sponsor').setDescription('Giveaway sponsor'))
        .addStringOption(opt => opt.setName('description').setDescription('Extra details or description'))
    )
    .addSubcommand(sub =>
      sub.setName('end')
        .setDescription('End an active giveaway immediately and pick winners')
        .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway Discord message ID').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('reroll')
        .setDescription('Reroll new winners for a finished giveaway')
        .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway Discord message ID').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('cancel')
        .setDescription('Cancel an active giveaway without picking winners')
        .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway Discord message ID').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all active giveaways in this server')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const guildSettings = getGuildSettings(guild.id);
    const db = getDatabase();

    // 1. CREATE
    if (subcommand === 'create') {
      const prize = interaction.options.getString('prize');
      const durationStr = interaction.options.getString('duration');
      const durationMs = parseDuration(durationStr);

      if (!durationMs) {
        return interaction.reply({
          embeds: [createErrorEmbed(guildSettings, 'Invalid Duration', 'Please use a format like `30m`, `2h`, or `1d`.')],
          ephemeral: true,
        });
      }

      const channel = interaction.options.getChannel('channel');
      const winnerCount = interaction.options.getInteger('winners') || 1;
      const requiredRole = interaction.options.getRole('required_role');
      const minAge = interaction.options.getInteger('min_account_age_days') || 0;
      const sponsor = interaction.options.getString('sponsor');
      const description = interaction.options.getString('description');

      try {
        const giveaway = await GiveawayService.createGiveaway(interaction.client, {
          guild,
          channel,
          prize,
          durationMs,
          winnerCount,
          requiredRoleId: requiredRole?.id || null,
          minAccountAgeDays: minAge,
          sponsor,
          description,
          createdBy: interaction.user.id,
        });

        await logAuditAction(interaction.client, guild.id, {
          userId: interaction.user.id,
          action: 'GIVEAWAY_CREATED',
          targetType: 'Giveaway',
          targetId: giveaway.id,
          details: { prize, channelId: channel.id, durationStr },
        });

        return interaction.reply({
          embeds: [createSuccessEmbed(guildSettings, 'Giveaway Launched', `Giveaway for **${prize}** is now running in <#${channel.id}>!`)],
          ephemeral: true,
        });
      } catch (err) {
        return interaction.reply({
          embeds: [createErrorEmbed(guildSettings, 'Giveaway Launch Failed', err.message)],
          ephemeral: true,
        });
      }
    }

    // 2. END
    if (subcommand === 'end') {
      const messageId = interaction.options.getString('message_id');
      const giveaway = db.prepare('SELECT * FROM giveaways WHERE message_id = ? AND guild_id = ?').get(messageId, guild.id);

      if (!giveaway) {
        return interaction.reply({ embeds: [createErrorEmbed(guildSettings, 'Not Found', 'Giveaway not found.')], ephemeral: true });
      }

      const winners = await GiveawayService.endGiveaway(interaction.client, giveaway.id, false);
      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Giveaway Concluded', `Giveaway ended. ${winners?.length || 0} winner(s) picked!`)],
        ephemeral: true,
      });
    }

    // 3. REROLL
    if (subcommand === 'reroll') {
      const messageId = interaction.options.getString('message_id');
      const giveaway = db.prepare('SELECT * FROM giveaways WHERE message_id = ? AND guild_id = ?').get(messageId, guild.id);

      if (!giveaway) {
        return interaction.reply({ embeds: [createErrorEmbed(guildSettings, 'Not Found', 'Giveaway not found.')], ephemeral: true });
      }

      const winners = await GiveawayService.endGiveaway(interaction.client, giveaway.id, true);
      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Giveaway Rerolled', `New winners picked: ${winners?.length || 0}`)],
        ephemeral: true,
      });
    }

    // 4. CANCEL
    if (subcommand === 'cancel') {
      const messageId = interaction.options.getString('message_id');
      const giveaway = db.prepare('SELECT * FROM giveaways WHERE message_id = ? AND guild_id = ?').get(messageId, guild.id);

      if (!giveaway) {
        return interaction.reply({ embeds: [createErrorEmbed(guildSettings, 'Not Found', 'Giveaway not found.')], ephemeral: true });
      }

      GiveawayService.cancelGiveaway(giveaway.id);
      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Giveaway Cancelled', 'The giveaway was cancelled.')],
        ephemeral: true,
      });
    }

    // 5. LIST
    if (subcommand === 'list') {
      const active = db.prepare('SELECT * FROM giveaways WHERE guild_id = ? AND ended = 0').all(guild.id);
      if (active.length === 0) {
        return interaction.reply({
          embeds: [createBananaEmbed(guildSettings, { title: 'Active Giveaways', description: 'No active giveaways right now. Create one using `/giveaway create`!' })],
          ephemeral: true,
        });
      }

      const fields = active.map(g => ({
        name: `🎉 ${g.prize} (#${g.id})`,
        value: `Channel: <#${g.channel_id}>\nEnds: <t:${Math.floor(g.ends_at / 1000)}:R>\nMessage ID: \`${g.message_id}\``,
        inline: false,
      }));

      const embed = createBananaEmbed(guildSettings, {
        title: 'Active Giveaways',
        fields,
      });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
