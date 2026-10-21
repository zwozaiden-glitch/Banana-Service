import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../config.js';
import { getGuildEmoji } from './emojis.js';

/**
 * Resolves color string or hex to integer
 */
export function resolveColor(colorStr, defaultColor = config.branding.defaultColor) {
  if (!colorStr) colorStr = defaultColor;
  if (typeof colorStr === 'number') return colorStr;
  const clean = colorStr.replace('#', '');
  const parsed = parseInt(clean, 16);
  return isNaN(parsed) ? 0xFFE135 : parsed;
}

/**
 * Creates standard Banana Service Embed
 */
export function createBananaEmbed(guildSettings = null, options = {}) {
  const embed = new EmbedBuilder();

  // Color selection
  const color = options.color || guildSettings?.embed_color || config.branding.defaultColor;
  embed.setColor(resolveColor(color));

  if (options.title) {
    const defaultEmoji = getGuildEmoji(guildSettings, 'banana');
    const titleEmoji = options.emoji ? `${options.emoji} ` : `${defaultEmoji} `;
    embed.setTitle(options.noEmoji ? options.title : `${titleEmoji}${options.title}`);
  }

  if (options.description) {
    embed.setDescription(options.description);
  }

  if (options.fields && Array.isArray(options.fields)) {
    embed.addFields(options.fields);
  }

  if (options.thumbnail) {
    embed.setThumbnail(options.thumbnail);
  }

  if (options.image) {
    embed.setImage(options.image);
  }

  if (options.url) {
    embed.setURL(options.url);
  }

  // Footer & Timestamp
  const footerText = options.footerText || guildSettings?.footer_text || config.branding.defaultFooter;
  const footerIcon = options.footerIcon || guildSettings?.footer_icon || null;
  embed.setFooter({ text: footerText, iconURL: footerIcon || undefined });

  if (options.timestamp !== false) {
    embed.setTimestamp(options.timestamp instanceof Date ? options.timestamp : new Date());
  }

  return embed;
}

export function createSuccessEmbed(guildSettings, title, description) {
  const check = getGuildEmoji(guildSettings, 'success');
  return createBananaEmbed(guildSettings, {
    title,
    description: `${check} ${description}`,
    color: config.branding.successColor,
    emoji: check,
    noEmoji: true,
  });
}

export function createErrorEmbed(guildSettings, title, description) {
  const cross = getGuildEmoji(guildSettings, 'error');
  return createBananaEmbed(guildSettings, {
    title,
    description: `${cross} ${description}`,
    color: config.branding.errorColor,
    emoji: cross,
    noEmoji: true,
  });
}

export function createWarningEmbed(guildSettings, title, description) {
  const warn = getGuildEmoji(guildSettings, 'warning');
  return createBananaEmbed(guildSettings, {
    title,
    description: `${warn} ${description}`,
    color: config.branding.warningColor,
    emoji: warn,
    noEmoji: true,
  });
}

export function createInfoEmbed(guildSettings, title, description) {
  const info = getGuildEmoji(guildSettings, 'info');
  return createBananaEmbed(guildSettings, {
    title,
    description: `${info} ${description}`,
    color: config.branding.infoColor,
    emoji: info,
    noEmoji: true,
  });
}

/**
 * Creates pagination ActionRow controls (First, Prev, Page indicator, Next, Last)
 */
export function createPaginationRow(currentPage, totalPages, customIdPrefix = 'page') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${customIdPrefix}_first_${currentPage}`)
      .setLabel('⏮️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage <= 1),
    new ButtonBuilder()
      .setCustomId(`${customIdPrefix}_prev_${currentPage}`)
      .setLabel('◀️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage <= 1),
    new ButtonBuilder()
      .setCustomId(`${customIdPrefix}_indicator`)
      .setLabel(`Page ${currentPage} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${customIdPrefix}_next_${currentPage}`)
      .setLabel('▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages),
    new ButtonBuilder()
      .setCustomId(`${customIdPrefix}_last_${currentPage}`)
      .setLabel('⏭️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages)
  );
}
