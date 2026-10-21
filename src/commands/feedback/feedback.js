import { SlashCommandBuilder } from 'discord.js';
import { FeedbackService } from '../../services/feedbackService.js';
import { ScriptService } from '../../services/scriptService.js';
import { getGuildSettings } from '../../database/db.js';
import { BananaPermissions } from '../../utils/permissions.js';
import { createBananaEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('feedback')
    .setDescription('Banana Service Feedback & Bug Reporting System')
    .addSubcommand(sub =>
      sub.setName('submit')
        .setDescription('Submit feedback, suggestions, or script bug reports')
        .addStringOption(opt =>
          opt.setName('type')
            .setDescription('Feedback Category')
            .setRequired(true)
            .addChoices(
              { name: 'General Bot Suggestion / Comment', value: 'general' },
              { name: 'Script Panel / Script Issue', value: 'script' }
            )
        )
        .addStringOption(opt => opt.setName('title').setDescription('Brief title of your feedback').setRequired(true))
        .addStringOption(opt => opt.setName('content').setDescription('Detailed description or bug reproduction steps').setRequired(true))
        .addIntegerOption(opt => opt.setName('rating').setDescription('Optional rating (1 to 5 stars)').setMinValue(1).setMaxValue(5))
        .addStringOption(opt => opt.setName('script_name_or_id').setDescription('Script name or ID (if reporting a script)'))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('View submitted feedback entries (Staff only)')
        .addStringOption(opt =>
          opt.setName('status')
            .setDescription('Filter by status')
            .addChoices(
              { name: 'Pending', value: 'pending' },
              { name: 'Accepted', value: 'accepted' },
              { name: 'In Progress', value: 'in_progress' },
              { name: 'Completed', value: 'completed' },
              { name: 'Rejected', value: 'rejected' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Update status and reply to a feedback item (Staff only)')
        .addIntegerOption(opt => opt.setName('id').setDescription('Feedback ID').setRequired(true))
        .addStringOption(opt =>
          opt.setName('new_status')
            .setDescription('New status')
            .setRequired(true)
            .addChoices(
              { name: 'Accepted', value: 'accepted' },
              { name: 'In Progress', value: 'in_progress' },
              { name: 'Completed', value: 'completed' },
              { name: 'Rejected', value: 'rejected' }
            )
        )
        .addStringOption(opt => opt.setName('notes').setDescription('Staff response / resolution note'))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const guildSettings = getGuildSettings(guild.id);

    if (subcommand === 'submit') {
      const type = interaction.options.getString('type');
      const title = interaction.options.getString('title');
      const content = interaction.options.getString('content');
      const rating = interaction.options.getInteger('rating');
      const scriptInput = interaction.options.getString('script_name_or_id');

      let scriptId = null;
      if (scriptInput) {
        const script = ScriptService.getScript(guild.id, scriptInput);
        if (script) scriptId = script.id;
      }

      const record = await FeedbackService.submitFeedback(interaction.client, {
        guildId: guild.id,
        type,
        scriptId,
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        title,
        content,
        rating,
      });

      return interaction.reply({
        embeds: [
          createSuccessEmbed(
            guildSettings,
            'Feedback Received',
            `Thank you! Your ${type === 'script' ? 'script report' : 'feedback'} has been submitted (Reference: **#${record.id}**). Staff will review it shortly. 🍌`
          ),
        ],
        ephemeral: true,
      });
    }

    if (subcommand === 'list') {
      if (!BananaPermissions.isStaff(interaction.member, guildSettings)) {
        return interaction.reply({ embeds: [createErrorEmbed(guildSettings, 'Permission Denied', 'Staff only.')], ephemeral: true });
      }

      const status = interaction.options.getString('status');
      const items = FeedbackService.listFeedback(guild.id, { status, limit: 10 });

      if (items.length === 0) {
        return interaction.reply({ content: 'No feedback items found.', ephemeral: true });
      }

      const fields = items.map(f => ({
        name: `#${f.id} [${f.status.toUpperCase()}] • ${f.title}`,
        value: `By: <@${f.user_id}> | Rating: ${f.rating ? `${f.rating}⭐` : 'N/A'}\n${f.content.slice(0, 150)}`,
        inline: false,
      }));

      const embed = createBananaEmbed(guildSettings, {
        title: 'Feedback Submissions',
        fields,
      });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'status') {
      if (!BananaPermissions.isStaff(interaction.member, guildSettings)) {
        return interaction.reply({ embeds: [createErrorEmbed(guildSettings, 'Permission Denied', 'Staff only.')], ephemeral: true });
      }

      const id = interaction.options.getInteger('id');
      const newStatus = interaction.options.getString('new_status');
      const notes = interaction.options.getString('notes');

      const updated = FeedbackService.updateStatus(id, newStatus, interaction.user.id, notes);
      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Status Updated', `Feedback #${id} set to **${newStatus.toUpperCase()}**!`)],
        ephemeral: true,
      });
    }
  },
};
