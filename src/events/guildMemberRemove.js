import { WelcomeService } from '../services/welcomeService.js';

export default {
  name: 'guildMemberRemove',
  async execute(member, client) {
    await WelcomeService.handleMemberLeave(client, member);
  },
};
