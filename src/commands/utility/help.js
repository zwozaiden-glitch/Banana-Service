import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { getGuildSettings } from '../../database/db.js';
import { createBananaEmbed } from '../../utils/embeds.js';
import { getGuildEmoji } from '../../utils/emojis.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Explore all Banana Service modules, slash commands, and features')
    .addStringOption(opt =>
      opt.setName('module')
        .setDescription('Specific module to view')
        .addChoices(
          { name: '📜 Script Management', value: 'scripts' },
          { name: '🎫 Ticket System', value: 'tickets' },
          { name: '🎉 Giveaways', value: 'giveaways' },
          { name: '▶️ YouTube Tracker', value: 'youtube' },
          { name: '🛡️ Verification & Welcome', value: 'gates' },
          { name: '🔨 Moderation & Roles', value: 'moderation' },
          { name: '🌐 Translation & Utility', value: 'utility' }
        )
    ),

  async execute(interaction) {
    const guildSettings = getGuildSettings(interaction.guild?.id);
    const selectedModule = interaction.options.getString('module');

    const modulesData = {
      scripts: {
        title: '📜 Script Management System',
        description: 'Complete suite for uploading, versioning, categorizing, and delivering scripts (.lua, .txt, etc.).',
        fields: [
          { name: '`/script list`', value: 'Browse stored scripts with filters and pagination.' },
          { name: '`/script info <name>`', value: 'View metadata, author, and version history.' },
          { name: '`/script upload`', value: 'Upload a new script file with custom roles and category.' },
          { name: '`/script update`', value: 'Release a new version of an existing script.' },
          { name: '`/script download <name>`', value: 'Securely download a script.' },
          { name: '`/script versions <name>`', value: 'Inspect all historical versions.' },
          { name: '`/script rollback <name> <ver>`', value: 'Restore an earlier version.' },
          { name: '`/setscript`', value: 'Quick configuration & channel binding for scripts.' },
          { name: '`/panel publish`', value: 'Publish interactive Script Hub with buttons in a channel.' },
          { name: '`/updates enable`', value: 'Auto-announce script releases in update channels.' },
        ],
      },
      tickets: {
        title: '🎫 Customizable Ticket System',
        description: 'Multi-category private support channels with transcripts and staff controls.',
        fields: [
          { name: '`/ticket panel`', value: 'Deploy interactive ticket category selector.' },
          { name: '`/ticket close [reason]`', value: 'Close ticket, archive messages, and generate HTML transcript.' },
          { name: '`/ticket add <user>`', value: 'Add a user or collaborator to current ticket.' },
          { name: '`/ticket remove <user>`', value: 'Remove a user from current ticket.' },
          { name: '`/ticket rename <name>`', value: 'Rename the active ticket channel.' },
          { name: '`/ticket category_add`', value: 'Create custom ticket categories with custom roles & emojis.' },
        ],
      },
      giveaways: {
        title: '🎉 Giveaway System',
        description: 'Persistent giveaway manager with automatic timers and rollbacks.',
        fields: [
          { name: '`/giveaway create`', value: 'Launch a giveaway with duration, winners, and role requirements.' },
          { name: '`/giveaway end <id>`', value: 'End an active giveaway immediately and pick winners.' },
          { name: '`/giveaway reroll <id>`', value: 'Reroll new winners from existing entries.' },
          { name: '`/giveaway list`', value: 'List all running giveaways in this server.' },
          { name: '`/giveaway cancel <id>`', value: 'Cancel an active giveaway.' },
        ],
      },
      youtube: {
        title: '▶️ YouTube Video Tracker',
        description: 'Monitors YouTube channels and automatically posts new uploads.',
        fields: [
          { name: '`/youtube add`', value: 'Start tracking a channel via URL, handle, or ID.' },
          { name: '`/youtube remove`', value: 'Stop tracking a YouTube channel.' },
          { name: '`/youtube list`', value: 'View all actively monitored YouTube channels.' },
        ],
      },
      gates: {
        title: '🛡️ Verification & Welcome System',
        description: 'Anti-bot gates and custom member arrival announcements.',
        fields: [
          { name: '`/verify setup`', value: 'Deploy verification panel with button or math challenge.' },
          { name: '`/verify config`', value: 'Inspect verification settings.' },
          { name: '`/verify disable`', value: 'Turn off the verification gate.' },
          { name: '`/welcome setup`', value: 'Configure welcome/goodbye channels and autoroles.' },
          { name: '`/welcome test`', value: 'Preview the welcome embed.' },
        ],
      },
      moderation: {
        title: '🔨 Moderation & Role Management',
        description: 'Server enforcement with role hierarchy protection and audit logs.',
        fields: [
          { name: '`/ban <user>` / `/kick <user>`', value: 'Remove rule-breakers from the guild.' },
          { name: '`/timeout <user> <min>`', value: 'Temporarily mute a member.' },
          { name: '`/warn <user> <reason>`', value: 'Issue a recorded infraction warning.' },
          { name: '`/warnings <user>`', value: 'Inspect a member\'s warning history.' },
          { name: '`/purge <amount>`', value: 'Bulk delete messages with optional user filter.' },
          { name: '`/slowmode <seconds>`', value: 'Adjust channel cooldown.' },
          { name: '`/role add / remove / panel / autorole`', value: 'Manage user and self-assignable roles.' },
          { name: '`/modlogs`', value: 'View recent administrative audit logs.' },
        ],
      },
      utility: {
        title: '🌐 Translation & Utilities',
        description: 'Translation engine preserving code/mentions plus helpful server tools.',
        fields: [
          { name: '`/translate <text> [lang]`', value: 'Real translation preserving code blocks and emojis.' },
          { name: '`/announce`', value: 'Publish formatted server announcement with pings and embeds.' },
          { name: '`/feedback submit / list / status`', value: 'Collect suggestions and script bug reports.' },
          { name: '`/poll`', value: 'Create interactive emoji polls.' },
          { name: '`/remind`', value: 'Set timed personal reminders.' },
          { name: '`/ping` / `/uptime` / `/botinfo`', value: 'Inspect bot performance and status.' },
          { name: '`/serverinfo` / `/userinfo` / `/avatar`', value: 'Guild and profile information.' },
          { name: '`/setup` / `/branding`', value: 'Configure server colors, footer, and branding.' },
        ],
      },
    };

    if (selectedModule && modulesData[selectedModule]) {
      const mod = modulesData[selectedModule];
      const embed = createBananaEmbed(guildSettings, {
        title: mod.title,
        description: mod.description,
        fields: mod.fields,
      });
      return interaction.reply({ embeds: [embed] });
    }

    // Default Overview Embed
    const bananaSparkle = getGuildEmoji(guildSettings, 'bananaSparkle');
    const embed = createBananaEmbed(guildSettings, {
      title: `${bananaSparkle} Banana Service — Command Guide`,
      description: [
        'Welcome to **Banana Service**, the premium Discord suite for script management, community automation, and server security.',
        '',
        'Use `/help <module>` or select a category below for in-depth command syntax.',
      ].join('\n'),
      fields: [
        { name: '📜 Script Hub', value: '`/script`, `/setscript`, `/panel`, `/updates`', inline: true },
        { name: '🎫 Ticket Desk', value: '`/ticket panel`, `/ticket close`, `/ticket add`', inline: true },
        { name: '🎉 Giveaways', value: '`/giveaway create`, `/giveaway end`, `/giveaway reroll`', inline: true },
        { name: '▶️ YouTube Tracker', value: '`/youtube add`, `/youtube list`', inline: true },
        { name: '🛡️ Gates & Roles', value: '`/verify`, `/welcome`, `/role`', inline: true },
        { name: '🔨 Moderation', value: '`/ban`, `/kick`, `/timeout`, `/warn`, `/purge`', inline: true },
        { name: '🌐 Translation', value: '`/translate` (French default, 12 languages)', inline: true },
        { name: '⚙️ Administration', value: '`/setup`, `/branding`, `/embed`, `/autoresponse`', inline: true },
      ],
      footerText: 'Banana Service • Type / to see all slash commands',
    });

    const menu = new StringSelectMenuBuilder()
      .setCustomId('help_module_select')
      .setPlaceholder('Choose a module to explore...')
      .addOptions([
        new StringSelectMenuOptionBuilder().setLabel('Script Management').setValue('scripts').setEmoji('📜'),
        new StringSelectMenuOptionBuilder().setLabel('Ticket System').setValue('tickets').setEmoji('🎫'),
        new StringSelectMenuOptionBuilder().setLabel('Giveaways').setValue('giveaways').setEmoji('🎉'),
        new StringSelectMenuOptionBuilder().setLabel('YouTube Tracker').setValue('youtube').setEmoji('▶️'),
        new StringSelectMenuOptionBuilder().setLabel('Verification & Welcome').setValue('gates').setEmoji('🛡️'),
        new StringSelectMenuOptionBuilder().setLabel('Moderation & Roles').setValue('moderation').setEmoji('🔨'),
        new StringSelectMenuOptionBuilder().setLabel('Translation & Utility').setValue('utility').setEmoji('🌐'),
      ]);

    const row = new ActionRowBuilder().addComponents(menu);
    return interaction.reply({ embeds: [embed], components: [row] });
  },
};
