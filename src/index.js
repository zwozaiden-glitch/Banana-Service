import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config.js';
import { getDatabase, closeDatabase } from './database/db.js';
import { loadCommands } from './commands/index.js';
import { YouTubeService } from './services/youtubeService.js';

// Import event handlers
import readyEvent from './events/ready.js';
import interactionCreateEvent from './events/interactionCreate.js';
import guildMemberAddEvent from './events/guildMemberAdd.js';
import guildMemberRemoveEvent from './events/guildMemberRemove.js';
import messageCreateEvent from './events/messageCreate.js';
import errorEvent from './events/error.js';

// Initialize Database connection & verify schema
console.log('🍌 Initializing Banana Service Database...');
getDatabase();
console.log('✅ Database connected and WAL mode enabled.');

// Instantiate Discord client with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
  ],
});

// Load slash & context commands
client.commands = loadCommands();
console.log(`✅ Loaded ${client.commands.size} Banana Service commands.`);

// Register Event Listeners
client.once(readyEvent.name, (...args) => readyEvent.execute(...args, client));
client.on(interactionCreateEvent.name, (...args) => interactionCreateEvent.execute(...args, client));
client.on(guildMemberAddEvent.name, (...args) => guildMemberAddEvent.execute(...args, client));
client.on(guildMemberRemoveEvent.name, (...args) => guildMemberRemoveEvent.execute(...args, client));
client.on(messageCreateEvent.name, (...args) => messageCreateEvent.execute(...args, client));
client.on(errorEvent.name, (...args) => errorEvent.execute(...args));

// Graceful shutdown handling
function handleShutdown(signal) {
  console.log(`\n[Banana Service] Received ${signal}. Shutting down gracefully...`);
  try {
    YouTubeService.stopPoller();
    closeDatabase();
    client.destroy();
    console.log('🍌 Banana Service shutdown complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// Uncaught Exception and Rejection protection
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection at]:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]:', err);
});

// Start bot
if (config.token) {
  client.login(config.token).catch((err) => {
    console.error('❌ Failed to login to Discord:', err.message);
    console.log('💡 Please check your DISCORD_TOKEN in .env');
  });
} else {
  console.log(`
⚠️  DISCORD_TOKEN is not configured!
To connect Banana Service to Discord:
1. Set DISCORD_TOKEN and CLIENT_ID in your host's environment variables (or a local .env file).
2. CLIENT_ID is the numeric Discord Application ID; an OAuth client secret is not used.
3. Run 'npm run deploy' once to register slash commands.
4. Start with 'npm start' (or 'node index.js' on panels that expect a root entrypoint).
  `);
}

export { client };
