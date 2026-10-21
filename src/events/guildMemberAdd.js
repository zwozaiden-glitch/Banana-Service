import { WelcomeService } from '../services/welcomeService.js';
import { getDatabase } from '../database/db.js';

export default {
  name: 'guildMemberAdd',
  async execute(member, client) {
    // 1. Check if unverified role should be applied
    try {
      const db = getDatabase();
      const verifySettings = db.prepare('SELECT * FROM verification_settings WHERE guild_id = ? AND is_enabled = 1').get(member.guild.id);
      if (verifySettings?.unverified_role_id) {
        const unverifiedRole = member.guild.roles.cache.get(verifySettings.unverified_role_id);
        if (unverifiedRole) {
          await member.roles.add(unverifiedRole).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Failed to assign unverified role on join:', err);
    }

    // 2. Welcome greetings & autoroles
    await WelcomeService.handleMemberJoin(client, member);
  },
};
