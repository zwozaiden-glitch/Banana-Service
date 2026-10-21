import { REST, Routes } from 'discord.js';
import { config } from './config.js';
import { getCommandsJson } from './commands/index.js';

const isGuildOnly = process.argv.includes('--guild');

async function deploy() {
  if (!config.token) {
    console.error('❌ Error: DISCORD_TOKEN is missing in .env');
    process.exit(1);
  }
  if (!config.clientId) {
    console.error('❌ Error: CLIENT_ID is missing in .env');
    process.exit(1);
  }

  const commands = getCommandsJson();
  const rest = new REST({ version: '10' }).setToken(config.token);

  console.log(`🍌 Banana Service: Deploying ${commands.length} application commands...`);

  try {
    if (isGuildOnly && config.devGuildId) {
      console.log(`Deploying commands to Development Guild (${config.devGuildId})...`);
      const data = await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.devGuildId),
        { body: commands }
      );
      console.log(`✅ Successfully registered ${data.length} guild commands!`);
    } else {
      console.log('Deploying commands globally across Discord...');
      const data = await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands }
      );
      console.log(`✅ Successfully registered ${data.length} global commands!`);
    }
  } catch (err) {
    console.error('❌ Failed to deploy slash commands:', err);
    process.exit(1);
  }
}

deploy();
