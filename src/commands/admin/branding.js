import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getGuildSettings, updateGuildSettings } from '../../database/db.js';
import { resolveEmoji } from '../../utils/emojis.js';
import { createBananaEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embeds.js';
import { logAuditAction } from '../../utils/auditLogger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('branding')
    .setDescription('Customize Banana Service theme, colors, emojis, and footer text')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('color')
        .setDescription('Set custom embed color for this server')
        .addStringOption(opt => opt.setName('hex').setDescription('Hex color code (e.g. #FFE135 or #FFB800)').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('footer')
        .setDescription('Set custom embed footer text and icon')
        .addStringOption(opt => opt.setName('text').setDescription('Footer text').setRequired(true))
        .addStringOption(opt => opt.setName('icon_url').setDescription('Icon URL for footer'))
    )
    .addSubcommand(sub =>
      sub.setName('emoji')
        .setDescription('Configure custom emojis for the bot')
        .addStringOption(opt =>
          opt.setName('key')
            .setDescription('Which emoji to customize')
            .setRequired(true)
            .addChoices(
              { name: 'Default Banana', value: 'banana' },
              { name: 'Success', value: 'success' },
              { name: 'Warning', value: 'warning' },
              { name: 'Error', value: 'error' },
              { name: 'Script Box', value: 'bananaBox' },
              { name: 'Ticket', value: 'bananaTicket' },
              { name: 'Giveaway', value: 'bananaParty' }
            )
        )
        .addStringOption(opt => opt.setName('emoji').setDescription('Emoji character or <:name:id>').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current server branding configuration')
    )
    .addSubcommand(sub =>
      sub.setName('reset')
        .setDescription('Reset branding to default Banana Service theme')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const guildSettings = getGuildSettings(guildId);

    if (subcommand === 'color') {
      const hex = interaction.options.getString('hex').trim();
      const valid = /^#?([0-9A-Fa-f]{6})$/.test(hex);
      if (!valid) {
        return interaction.reply({
          embeds: [createErrorEmbed(guildSettings, 'Invalid Color', 'Please provide a 6-digit hex code like `#FFE135`.')],
          ephemeral: true,
        });
      }

      const formatted = hex.startsWith('#') ? hex : `#${hex}`;
      updateGuildSettings(guildId, { embed_color: formatted });

      await logAuditAction(interaction.client, guildId, {
        userId: interaction.user.id,
        action: 'BRANDING_COLOR_UPDATE',
        details: { color: formatted },
      });

      return interaction.reply({
        embeds: [createSuccessEmbed(getGuildSettings(guildId), 'Color Updated', `Primary embed color set to \`${formatted}\`!`)],
        ephemeral: true,
      });
    }

    if (subcommand === 'footer') {
      const text = interaction.options.getString('text');
      const iconUrl = interaction.options.getString('icon_url');

      updateGuildSettings(guildId, {
        footer_text: text,
        footer_icon: iconUrl || null,
      });

      return interaction.reply({
        embeds: [createSuccessEmbed(getGuildSettings(guildId), 'Footer Updated', `Custom footer text set to: "${text}"`)],
        ephemeral: true,
      });
    }

    if (subcommand === 'emoji') {
      const key = interaction.options.getString('key');
      const rawEmoji = interaction.options.getString('emoji');
      const safeEmoji = resolveEmoji(rawEmoji, key);

      let customMap = {};
      if (guildSettings.custom_emojis) {
        try {
          customMap = typeof guildSettings.custom_emojis === 'string'
            ? JSON.parse(guildSettings.custom_emojis)
            : guildSettings.custom_emojis;
        } catch {
          customMap = {};
        }
      }

      customMap[key] = safeEmoji;
      updateGuildSettings(guildId, { custom_emojis: customMap });

      return interaction.reply({
        embeds: [createSuccessEmbed(getGuildSettings(guildId), 'Emoji Updated', `Emoji for \`${key}\` is now ${safeEmoji}!`)],
        ephemeral: true,
      });
    }

    if (subcommand === 'view') {
      const current = getGuildSettings(guildId);
      const embed = createBananaEmbed(current, {
        title: '🎨 Server Branding & Appearance',
        fields: [
          { name: 'Embed Color', value: `\`${current.embed_color}\``, inline: true },
          { name: 'Footer Text', value: current.footer_text || 'Default', inline: true },
          { name: 'Custom Emojis', value: current.custom_emojis || 'Default Unicode', inline: false },
        ],
      });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'reset') {
      updateGuildSettings(guildId, {
        embed_color: '#FFE135',
        footer_text: 'Banana Service • Premium Discord Suite 🍌',
        footer_icon: null,
        custom_emojis: '{}',
      });

      return interaction.reply({
        embeds: [createSuccessEmbed(getGuildSettings(guildId), 'Branding Reset', 'Branding restored to default Banana Service theme!')],
        ephemeral: true,
      });
    }
  },
};
