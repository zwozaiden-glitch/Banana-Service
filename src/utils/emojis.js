/**
 * Banana Service Emoji System
 * Supports customizable emojis per server with resilient Unicode fallbacks.
 */

export const DEFAULT_EMOJIS = {
  // Brand
  banana: '🍌',
  bananaSparkle: '🍌✨',
  bananaBox: '🍌📦',
  bananaWrench: '🍌🔧',
  bananaShield: '🍌🛡️',
  bananaRocket: '🍌🚀',
  bananaTicket: '🍌🎫',
  bananaParty: '🍌🎉',

  // Status & Feedback
  success: '✅',
  warning: '⚠️',
  error: '❌',
  info: 'ℹ️',
  loading: '⏳',
  dot: '•',
  star: '⭐',

  // Navigation & Actions
  arrowRight: '➡️',
  arrowLeft: '⬅️',
  download: '📥',
  upload: '📤',
  search: '🔍',
  edit: '✏️',
  trash: '🗑️',
  refresh: '🔄',
  link: '🔗',
  lock: '🔒',
  unlock: '🔓',

  // Categories & Features
  script: '📜',
  ticket: '🎫',
  giveaway: '🎉',
  verify: '🛡️',
  youtube: '▶️',
  announce: '📢',
  mod: '🔨',
  role: '🏷️',
  feedback: '💬',
  history: '🕰️',
  stats: '📊',
};

/**
 * Validates whether a Discord emoji string is well-formed or a standard unicode character.
 * Handles Discord custom emojis (<:name:id> or <a:name:id>) and standard unicode emojis.
 */
export function resolveEmoji(emojiStr, fallbackKey = 'banana') {
  if (!emojiStr || typeof emojiStr !== 'string') {
    return DEFAULT_EMOJIS[fallbackKey] || '🍌';
  }

  const trimmed = emojiStr.trim();
  // Check Discord custom emoji pattern: <:name:123456789012345678> or animated <a:name:123456789012345678>
  const customEmojiRegex = /^<(a)?:[a-zA-Z0-9_]+:\d{17,20}>$/;
  if (customEmojiRegex.test(trimmed)) {
    return trimmed;
  }

  // Unicode emoji check: reasonable length (most unicode emojis are 1-8 chars)
  if (trimmed.length > 0 && trimmed.length <= 12) {
    return trimmed;
  }

  return DEFAULT_EMOJIS[fallbackKey] || '🍌';
}

/**
 * Get configured guild emoji or default
 */
export function getGuildEmoji(guildSettings, key, fallbackKey = null) {
  if (guildSettings?.custom_emojis) {
    try {
      const parsed = typeof guildSettings.custom_emojis === 'string'
        ? JSON.parse(guildSettings.custom_emojis)
        : guildSettings.custom_emojis;
      if (parsed[key]) {
        return resolveEmoji(parsed[key], fallbackKey || key);
      }
    } catch {
      // Fallback on JSON parse error
    }
  }
  return DEFAULT_EMOJIS[key] || DEFAULT_EMOJIS[fallbackKey] || '🍌';
}
