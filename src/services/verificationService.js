import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { getDatabase, getGuildSettings } from '../database/db.js';
import { createBananaEmbed, createSuccessEmbed, createErrorEmbed } from '../utils/embeds.js';
import { getGuildEmoji } from '../utils/emojis.js';
import { logAuditAction } from '../utils/auditLogger.js';

export class VerificationService {
  static pendingChallenges = new Map();

  static getSettings(guildId) {
    const db = getDatabase();
    let row = db.prepare('SELECT * FROM verification_settings WHERE guild_id = ?').get(guildId);
    if (!row) {
      db.prepare('INSERT INTO verification_settings (guild_id) VALUES (?)').run(guildId);
      row = db.prepare('SELECT * FROM verification_settings WHERE guild_id = ?').get(guildId);
    }
    return row;
  }

  static buildVerificationPanel(guildSettings, settings) {
    const bananaShield = getGuildEmoji(guildSettings, 'bananaShield');
    const embed = createBananaEmbed(guildSettings, {
      title: `${bananaShield} Server Verification Required`,
      description: settings.instructions || 'Welcome! To gain full access to the server, please verify your account by clicking the button below.',
      fields: [
        { name: '🛡️ Protection', value: 'This quick step helps keep our community safe from automated spam bots.', inline: false },
      ],
      color: '#FFE135',
      footerText: 'Banana Service • Verification Gate',
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verify_action_btn')
        .setLabel('Verify Account')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🍌')
    );

    return { embeds: [embed], components: [row] };
  }

  /**
   * Generates a math challenge or direct verification
   */
  static async handleVerifyButton(client, interaction) {
    const guild = interaction.guild;
    const settings = this.getSettings(guild.id);

    if (!settings.is_enabled || !settings.verified_role_id) {
      return interaction.reply({
        content: '⚠️ Verification is currently not configured or disabled by administrators.',
        ephemeral: true,
      });
    }

    const member = interaction.member;

    // Check if member already has verified role
    if (member.roles.cache.has(settings.verified_role_id)) {
      return interaction.reply({
        content: '✅ You are already verified in this server!',
        ephemeral: true,
      });
    }

    if (settings.challenge_type === 'math') {
      const num1 = Math.floor(Math.random() * 10) + 1;
      const num2 = Math.floor(Math.random() * 10) + 1;
      const answer = num1 + num2;

      const challengeId = `math_${interaction.user.id}_${Date.now()}`;
      this.pendingChallenges.set(interaction.user.id, { answer, expires: Date.now() + 60000 });

      const modal = new ModalBuilder()
        .setCustomId(`verify_modal_${challengeId}`)
        .setTitle('🍌 Banana Verification Challenge');

      const mathInput = new TextInputBuilder()
        .setCustomId('math_answer')
        .setLabel(`What is ${num1} + ${num2}?`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(4);

      modal.addComponents(new ActionRowBuilder().addComponents(mathInput));
      return interaction.showModal(modal);
    }

    // Direct button verification
    await this.completeVerification(client, interaction, member, settings);
  }

  static async handleModalSubmit(client, interaction) {
    const challenge = this.pendingChallenges.get(interaction.user.id);
    const settings = this.getSettings(interaction.guild.id);

    if (!challenge || Date.now() > challenge.expires) {
      this.pendingChallenges.delete(interaction.user.id);
      return interaction.reply({ content: '❌ Verification challenge expired. Please click verify again.', ephemeral: true });
    }

    const userAnswer = parseInt(interaction.fields.getTextInputValue('math_answer').trim(), 10);
    if (userAnswer !== challenge.answer) {
      this.pendingChallenges.delete(interaction.user.id);
      await logAuditAction(client, interaction.guild.id, {
        userId: interaction.user.id,
        action: 'VERIFICATION_FAILED',
        details: `Incorrect answer. Given: ${userAnswer}, Expected: ${challenge.answer}`,
      });
      return interaction.reply({ content: '❌ Incorrect answer. Verification failed. Please try again.', ephemeral: true });
    }

    this.pendingChallenges.delete(interaction.user.id);
    await this.completeVerification(client, interaction, interaction.member, settings);
  }

  static async completeVerification(client, interaction, member, settings) {
    try {
      const verifiedRole = interaction.guild.roles.cache.get(settings.verified_role_id);
      if (verifiedRole) {
        await member.roles.add(verifiedRole);
      }

      if (settings.unverified_role_id && member.roles.cache.has(settings.unverified_role_id)) {
        await member.roles.remove(settings.unverified_role_id).catch(() => {});
      }

      await logAuditAction(client, interaction.guild.id, {
        userId: member.id,
        action: 'VERIFICATION_SUCCESS',
        details: 'Member passed verification challenge.',
      });

      const replyContent = '🍌✨ **Verification successful!** You now have access to the server. Welcome!';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: replyContent, ephemeral: true });
      } else {
        await interaction.reply({ content: replyContent, ephemeral: true });
      }
    } catch (err) {
      console.error('Failed to apply verified role:', err);
      const errMsg = '❌ Failed to assign verified role. Please make sure the bot role is positioned higher than the verified role.';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errMsg, ephemeral: true });
      } else {
        await interaction.reply({ content: errMsg, ephemeral: true });
      }
    }
  }
}
