import { getDatabase } from '../database/db.js';

const cooldowns = new Map();

export default {
  name: 'messageCreate',
  async execute(message, client) {
    // Avoid bot messages and DMs to prevent recursion
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const content = message.content.trim();
    const db = getDatabase();

    // 1. Custom Text Commands (e.g., !rules, !help, !info)
    if (content.startsWith('!')) {
      const commandName = content.slice(1).split(/\s+/)[0].toLowerCase();
      const customCmd = db.prepare('SELECT response_text FROM custom_commands WHERE guild_id = ? AND command_name = ?').get(guildId, commandName);
      if (customCmd) {
        return message.channel.send(customCmd.response_text).catch(() => {});
      }
    }

    // 2. Auto-Responses
    try {
      const autoResponses = db.prepare('SELECT * FROM auto_responses WHERE guild_id = ?').all(guildId);
      const lowerContent = content.toLowerCase();

      for (const ar of autoResponses) {
        let match = false;
        if (ar.match_type === 'exact' && lowerContent === ar.trigger_phrase.toLowerCase()) {
          match = true;
        } else if (ar.match_type === 'contains' && lowerContent.includes(ar.trigger_phrase.toLowerCase())) {
          match = true;
        }

        if (match) {
          const cooldownKey = `${guildId}_${ar.id}`;
          const lastTriggered = cooldowns.get(cooldownKey) || 0;
          const now = Date.now();

          if (now - lastTriggered > (ar.cooldown_seconds || 5) * 1000) {
            cooldowns.set(cooldownKey, now);
            await message.channel.send(ar.response_text).catch(() => {});
            break; // Stop after first matched trigger
          }
        }
      }
    } catch (err) {
      console.warn('Error evaluating auto-response:', err);
    }
  },
};
