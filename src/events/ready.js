import { ActivityType } from 'discord.js';
import { config } from '../config.js';
import { GiveawayService } from '../services/giveawayService.js';
import { YouTubeService } from '../services/youtubeService.js';

export default {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`
=====================================================
🍌 BANANA SERVICE DISCORD BOT ONLINE
Logged in as: ${client.user.tag} (ID: ${client.user.id})
Serving: ${client.guilds.cache.size} guild(s) | ${client.users.cache.size} user(s)
Environment: ${config.isDev ? 'Development' : 'Production'}
Node Version: ${process.version}
=====================================================
    `);

    // Set bot presence
    client.user.setPresence({
      activities: [
        {
          name: config.branding.statusText,
          type: ActivityType.Watching,
        },
      ],
      status: 'online',
    });

    // Restore active giveaways and timers
    GiveawayService.restoreGiveaways(client);

    // Start background YouTube video tracker
    YouTubeService.startPoller(client);
  },
};
