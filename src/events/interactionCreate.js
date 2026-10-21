import {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import fs from 'node:fs';
import { getDatabase, getGuildSettings } from '../database/db.js';
import { GiveawayService } from '../services/giveawayService.js';
import { TicketService } from '../services/ticketService.js';
import { VerificationService } from '../services/verificationService.js';
import { ScriptService } from '../services/scriptService.js';
import { PanelService } from '../services/panelService.js';
import { FeedbackService } from '../services/feedbackService.js';
import { BananaPermissions } from '../utils/permissions.js';
import { createBananaEmbed, createSuccessEmbed, createErrorEmbed, createPaginationRow } from '../utils/embeds.js';
import { generateHtmlTranscript } from '../utils/transcriptGenerator.js';

export default {
  name: 'interactionCreate',
  async execute(interaction, client) {
    const guildSettings = getGuildSettings(interaction.guild?.id);

    // ==========================================
    // 1. SLASH & CONTEXT MENU COMMANDS
    // ==========================================
    if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        return interaction.reply({
          embeds: [createErrorEmbed(guildSettings, 'Unknown Command', 'This command is no longer registered.')],
          ephemeral: true,
        });
      }

      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(`[Error executing /${interaction.commandName}]:`, err);
        const errMsg = '❌ An unexpected error occurred while executing this command.';
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errMsg, ephemeral: true }).catch(() => {});
        } else {
          await interaction.reply({ content: errMsg, ephemeral: true }).catch(() => {});
        }
      }
      return;
    }

    // ==========================================
    // 2. BUTTON INTERACTIONS
    // ==========================================
    if (interaction.isButton()) {
      const customId = interaction.customId;

      // Giveaway Enter
      if (customId.startsWith('giveaway_enter_')) {
        const giveawayId = parseInt(customId.replace('giveaway_enter_', ''), 10);
        return GiveawayService.handleEntry(client, interaction, giveawayId);
      }

      // Verification Button
      if (customId === 'verify_action_btn') {
        return VerificationService.handleVerifyButton(client, interaction);
      }

      // Self Role Toggle Button
      if (customId.startsWith('selfrole_')) {
        const roleId = customId.replace('selfrole_', '');
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) {
          return interaction.reply({ content: '❌ Role no longer exists.', ephemeral: true });
        }

        const member = interaction.member;
        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(role).catch(() => {});
          return interaction.reply({ content: `Removed role **${role.name}**.`, ephemeral: true });
        } else {
          await member.roles.add(role).catch(() => {});
          return interaction.reply({ content: `🍌 Assigned role **${role.name}**!`, ephemeral: true });
        }
      }

      // Script Direct Download Button
      if (customId.startsWith('script_dl_')) {
        const scriptId = parseInt(customId.replace('script_dl_', ''), 10);
        const script = ScriptService.getScriptById(scriptId);

        if (!script) {
          return interaction.reply({ content: '❌ Script was not found.', ephemeral: true });
        }

        if (!BananaPermissions.canAccessScript(interaction.member, script, guildSettings)) {
          return interaction.reply({ content: '❌ You do not have the required role to download this script.', ephemeral: true });
        }

        if (!fs.existsSync(script.current_filename)) {
          return interaction.reply({ content: '❌ File is missing from storage host.', ephemeral: true });
        }

        ScriptService.recordDownload(script.id);
        const attachment = new AttachmentBuilder(script.current_filename, { name: script.original_filename });
        return interaction.reply({
          content: `🍌 Download for **${script.name}** (v${script.version}):`,
          files: [attachment],
          ephemeral: true,
        });
      }

      // Ticket Controls
      if (customId.startsWith('ticket_claim_')) {
        const ticketId = parseInt(customId.replace('ticket_claim_', ''), 10);
        return TicketService.claimTicket(interaction, ticketId);
      }

      if (customId.startsWith('ticket_close_')) {
        const ticketId = parseInt(customId.replace('ticket_close_', ''), 10);
        return TicketService.closeTicket(client, interaction, ticketId, 'Closed via control button');
      }

      if (customId.startsWith('ticket_reopen_')) {
        const ticketId = parseInt(customId.replace('ticket_reopen_', ''), 10);
        return TicketService.reopenTicket(interaction, ticketId);
      }

      if (customId.startsWith('ticket_delete_')) {
        const ticketId = parseInt(customId.replace('ticket_delete_', ''), 10);
        if (!BananaPermissions.isAdmin(interaction.member) && !BananaPermissions.isStaff(interaction.member, guildSettings)) {
          return interaction.reply({ content: '❌ Only staff can permanently delete ticket channels.', ephemeral: true });
        }

        await interaction.reply({ content: '🗑️ Ticket channel will be deleted in 5 seconds...' });
        setTimeout(async () => {
          await interaction.channel.delete().catch(() => {});
        }, 5000);
        return;
      }

      if (customId.startsWith('ticket_transcript_')) {
        const ticketId = parseInt(customId.replace('ticket_transcript_', ''), 10);
        const db = getDatabase();
        const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
        if (!ticket) return interaction.reply({ content: 'Ticket not found', ephemeral: true });

        const html = await generateHtmlTranscript(interaction.channel, ticket);
        const file = new AttachmentBuilder(html.filePath, { name: html.fileName });
        return interaction.reply({
          content: '📜 Here is the HTML transcript of this ticket channel:',
          files: [file],
          ephemeral: true,
        });
      }

      // Script Hub Panel Actions
      if (customId.startsWith('panel_browse_')) {
        const scripts = ScriptService.listScripts(interaction.guild.id, { limit: 25 }).items;
        if (scripts.length === 0) {
          return interaction.reply({ content: '📂 No scripts are currently available in the repository.', ephemeral: true });
        }

        const menu = new StringSelectMenuBuilder()
          .setCustomId('panel_script_select')
          .setPlaceholder('Select a script to view details or download...')
          .addOptions(
            scripts.slice(0, 25).map(s =>
              new StringSelectMenuOptionBuilder()
                .setLabel(`${s.name} (v${s.version})`.slice(0, 100))
                .setDescription(`${s.category} • ${s.original_filename}`.slice(0, 100))
                .setValue(String(s.id))
                .setEmoji('📦')
            )
          );

        return interaction.reply({
          content: '📂 **Banana Service Script Catalog:**',
          components: [new ActionRowBuilder().addComponents(menu)],
          ephemeral: true,
        });
      }

      if (customId.startsWith('panel_search_')) {
        const modal = new ModalBuilder()
          .setCustomId('panel_search_modal')
          .setTitle('Search Banana Script Hub');

        const input = new TextInputBuilder()
          .setCustomId('search_query')
          .setLabel('Script name or keyword')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (customId.startsWith('panel_latest_')) {
        const latest = ScriptService.listScripts(interaction.guild.id, { limit: 5 }).items;
        if (latest.length === 0) {
          return interaction.reply({ content: 'No scripts found.', ephemeral: true });
        }

        const fields = latest.map(s => ({
          name: `📦 ${s.name} (v${s.version})`,
          value: `**Category:** \`${s.category}\` • **Downloads:** \`${s.download_count}\`\nUpdated: <t:${Math.floor(new Date(s.updated_at).getTime() / 1000)}:R>`,
        }));

        const embed = createBananaEmbed(guildSettings, {
          title: '✨ Latest Script Releases & Updates',
          fields,
        });

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (customId.startsWith('panel_submit_')) {
        const modal = new ModalBuilder()
          .setCustomId('panel_submit_modal')
          .setTitle('Submit a Script to Banana Service');

        const nameInput = new TextInputBuilder()
          .setCustomId('submit_name')
          .setLabel('Script Name')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const descInput = new TextInputBuilder()
          .setCustomId('submit_desc')
          .setLabel('Description & Instructions')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        const linkInput = new TextInputBuilder()
          .setCustomId('submit_link')
          .setLabel('Download / Paste Link or Repository')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(nameInput),
          new ActionRowBuilder().addComponents(descInput),
          new ActionRowBuilder().addComponents(linkInput)
        );

        return interaction.showModal(modal);
      }

      if (customId.startsWith('panel_refresh_')) {
        const panelId = parseInt(customId.replace('panel_refresh_', ''), 10);
        await PanelService.refreshPanel(client, panelId);
        return interaction.reply({ content: '🔄 Panel refreshed successfully!', ephemeral: true });
      }

      // Feedback Review Workflow Buttons
      if (customId.startsWith('fb_accept_') || customId.startsWith('fb_reject_') || customId.startsWith('fb_progress_')) {
        if (!BananaPermissions.isStaff(interaction.member, guildSettings)) {
          return interaction.reply({ content: '❌ Staff only.', ephemeral: true });
        }

        const parts = customId.split('_');
        const action = parts[1];
        const fbId = parseInt(parts[2], 10);

        const statusMap = {
          accept: 'accepted',
          reject: 'rejected',
          progress: 'in_progress',
        };

        const newStatus = statusMap[action];
        FeedbackService.updateStatus(fbId, newStatus, interaction.user.id);
        return interaction.reply({
          content: `✅ Feedback #${fbId} has been marked as **${newStatus.toUpperCase()}** by <@${interaction.user.id}>.`,
        });
      }
    }

    // ==========================================
    // 3. SELECT MENUS
    // ==========================================
    if (interaction.isStringSelectMenu()) {
      const customId = interaction.customId;

      // Ticket Creation Menu
      if (customId === 'ticket_create_select') {
        const categoryId = parseInt(interaction.values[0], 10);
        return TicketService.createTicket(client, interaction, categoryId);
      }

      // Panel Script Selection
      if (customId === 'panel_script_select') {
        const scriptId = parseInt(interaction.values[0], 10);
        const script = ScriptService.getScriptById(scriptId);

        if (!script) {
          return interaction.reply({ content: '❌ Script not found.', ephemeral: true });
        }

        const embed = createBananaEmbed(guildSettings, {
          title: `📦 ${script.name} (v${script.version})`,
          fields: [
            { name: 'Category', value: script.category, inline: true },
            { name: 'File', value: script.original_filename, inline: true },
            { name: 'Downloads', value: String(script.download_count), inline: true },
            { name: 'Description', value: script.description || 'No description', inline: false },
          ],
        });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`script_dl_${script.id}`)
            .setLabel(`Download ${script.original_filename}`)
            .setStyle(ButtonStyle.Success)
            .setEmoji('📥')
        );

        return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      // Help Module Selector
      if (customId === 'help_module_select') {
        const moduleVal = interaction.values[0];
        const helpCommand = client.commands.get('help');
        if (helpCommand) {
          // Fake options object
          const mockInteraction = {
            ...interaction,
            options: {
              getString: (k) => k === 'module' ? moduleVal : null,
            },
            reply: (payload) => interaction.update(payload),
          };
          return helpCommand.execute(mockInteraction);
        }
      }
    }

    // ==========================================
    // 4. MODALS
    // ==========================================
    if (interaction.isModalSubmit()) {
      const customId = interaction.customId;

      if (customId.startsWith('verify_modal_')) {
        return VerificationService.handleModalSubmit(client, interaction);
      }

      if (customId === 'panel_search_modal') {
        const query = interaction.fields.getTextInputValue('search_query');
        const results = ScriptService.listScripts(interaction.guild.id, { search: query, limit: 10 }).items;

        if (results.length === 0) {
          return interaction.reply({ content: `🔍 No scripts found matching **"${query}"**.`, ephemeral: true });
        }

        const fields = results.map(s => ({
          name: `📦 ${s.name} (v${s.version})`,
          value: `Category: \`${s.category}\` • File: \`${s.original_filename}\`\nUse \`/script download name_or_id:${s.id}\` to retrieve.`,
        }));

        const embed = createBananaEmbed(guildSettings, {
          title: `🔍 Search Results for "${query}"`,
          fields,
        });

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (customId === 'panel_submit_modal') {
        const name = interaction.fields.getTextInputValue('submit_name');
        const desc = interaction.fields.getTextInputValue('submit_desc');
        const link = interaction.fields.getTextInputValue('submit_link');

        await FeedbackService.submitFeedback(client, {
          guildId: interaction.guild.id,
          type: 'script',
          userId: interaction.user.id,
          userTag: interaction.user.tag,
          title: `Script Submission: ${name}`,
          content: `Link: ${link}\nDescription: ${desc}`,
        });

        return interaction.reply({
          content: `🍌✨ Thank you for submitting **${name}**! Our staff team will review your script shortly.`,
          ephemeral: true,
        });
      }
    }
  },
};
