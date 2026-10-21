import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { WelcomeService } from '../../services/welcomeService.js';
import { getDatabase, getGuildSettings } from '../../database/db.js';
import { createBananaEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Banana Service Welcome & Goodbye System')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Configure welcome and goodbye channels')
        .addChannelOption(opt =>
          opt.setName('welcome_channel')
            .setDescription('Channel for new member greetings')
            .addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption(opt =>
          opt.setName('goodbye_channel')
            .setDescription('Channel for member departures')
            .addChannelTypes(ChannelType.GuildText)
        )
        .addRoleOption(opt => opt.setName('auto_role').setDescription('Role automatically assigned to new joins'))
        .addStringOption(opt => opt.setName('welcome_message').setDescription('Custom welcome message (supports {user}, {server}, {member_count})'))
    )
    .addSubcommand(sub =>
      sub.setName('test')
        .setDescription('Test the welcome greeting with your own account')
    )
    .addSubcommand(sub =>
      sub.setName('config')
        .setDescription('View current welcome settings')
    )
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Disable welcome and goodbye announcements')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const guildSettings = getGuildSettings(guild.id);
    const db = getDatabase();

    if (subcommand === 'setup') {
      const welcomeChannel = interaction.options.getChannel('welcome_channel');
      const goodbyeChannel = interaction.options.getChannel('goodbye_channel');
      const autoRole = interaction.options.getRole('auto_role');
      const welcomeMsg = interaction.options.getString('welcome_message');

      const updates = ['is_enabled = 1'];
      const values = [];

      if (welcomeChannel) { updates.push('welcome_channel_id = ?'); values.push(welcomeChannel.id); }
      if (goodbyeChannel) { updates.push('goodbye_channel_id = ?'); values.push(goodbyeChannel.id); }
      if (autoRole) { updates.push('auto_role_id = ?'); values.push(autoRole.id); }
      if (welcomeMsg) { updates.push('welcome_message = ?'); values.push(welcomeMsg); }

      db.prepare(`
        INSERT INTO welcome_settings (guild_id) VALUES (?)
        ON CONFLICT(guild_id) DO NOTHING
      `).run(guild.id);

      db.prepare(`UPDATE welcome_settings SET ${updates.join(', ')} WHERE guild_id = ?`).run(...values, guild.id);

      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Welcome System Configured', 'Welcome settings have been updated!')],
        ephemeral: true,
      });
    }

    if (subcommand === 'test') {
      await WelcomeService.handleMemberJoin(interaction.client, interaction.member);
      return interaction.reply({ content: '🍌 Welcome test triggered!', ephemeral: true });
    }

    if (subcommand === 'config') {
      const cfg = WelcomeService.getSettings(guild.id);
      const embed = createBananaEmbed(guildSettings, {
        title: 'Welcome & Goodbye Config',
        fields: [
          { name: 'Status', value: cfg.is_enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
          { name: 'Welcome Channel', value: cfg.welcome_channel_id ? `<#${cfg.welcome_channel_id}>` : 'Not set', inline: true },
          { name: 'Goodbye Channel', value: cfg.goodbye_channel_id ? `<#${cfg.goodbye_channel_id}>` : 'Not set', inline: true },
          { name: 'Auto-Role', value: cfg.auto_role_id ? `<@&${cfg.auto_role_id}>` : 'None', inline: true },
          { name: 'Template', value: cfg.welcome_message || 'Default', inline: false },
        ],
      });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'disable') {
      db.prepare('UPDATE welcome_settings SET is_enabled = 0 WHERE guild_id = ?').run(guild.id);
      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Welcome Disabled', 'Welcome greetings have been turned off.')],
        ephemeral: true,
      });
    }
  },
};
