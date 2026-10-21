import { Collection } from 'discord.js';

// Import all commands
import scriptCmd from './scripts/script.js';
import setscriptCmd from './scripts/setscript.js';
import panelCmd from './panel/panel.js';
import translateCmd from './translate/translate.js';
import translateContextMenu from './translate/translateContextMenu.js';
import announceCmd from './announcements/announce.js';
import updatesCmd from './announcements/updates.js';
import youtubeCmd from './youtube/youtube.js';
import roleCmd from './roles/role.js';
import giveawayCmd from './giveaways/giveaway.js';
import ticketCmd from './tickets/ticket.js';
import verifyCmd from './verification/verify.js';
import welcomeCmd from './welcome/welcome.js';
import feedbackCmd from './feedback/feedback.js';
import banCmd from './moderation/ban.js';
import kickCmd from './moderation/kick.js';
import timeoutCmd from './moderation/timeout.js';
import warnCmd from './moderation/warn.js';
import warningsCmd from './moderation/warnings.js';
import purgeCmd from './moderation/purge.js';
import slowmodeCmd from './moderation/slowmode.js';
import modlogsCmd from './moderation/modlogs.js';
import pingCmd from './utility/ping.js';
import uptimeCmd from './utility/uptime.js';
import botinfoCmd from './utility/botinfo.js';
import serverinfoCmd from './utility/serverinfo.js';
import userinfoCmd from './utility/userinfo.js';
import avatarCmd from './utility/avatar.js';
import pollCmd from './utility/poll.js';
import remindCmd from './utility/remind.js';
import suggestCmd from './utility/suggest.js';
import helpCmd from './utility/help.js';
import embedCmd from './custom/embed.js';
import autoresponseCmd from './custom/autoresponse.js';
import customcmdCmd from './custom/customcmd.js';
import brandingCmd from './admin/branding.js';
import setupCmd from './admin/setup.js';
import backupCmd from './admin/backup.js';

export const allCommandsList = [
  scriptCmd,
  setscriptCmd,
  panelCmd,
  translateCmd,
  translateContextMenu,
  announceCmd,
  updatesCmd,
  youtubeCmd,
  roleCmd,
  giveawayCmd,
  ticketCmd,
  verifyCmd,
  welcomeCmd,
  feedbackCmd,
  banCmd,
  kickCmd,
  timeoutCmd,
  warnCmd,
  warningsCmd,
  purgeCmd,
  slowmodeCmd,
  modlogsCmd,
  pingCmd,
  uptimeCmd,
  botinfoCmd,
  serverinfoCmd,
  userinfoCmd,
  avatarCmd,
  pollCmd,
  remindCmd,
  suggestCmd,
  helpCmd,
  embedCmd,
  autoresponseCmd,
  customcmdCmd,
  brandingCmd,
  setupCmd,
  backupCmd,
];

export function loadCommands() {
  const collection = new Collection();
  for (const cmd of allCommandsList) {
    if (cmd?.data?.name) {
      collection.set(cmd.data.name, cmd);
    }
  }
  return collection;
}

export function getCommandsJson() {
  return allCommandsList.map(c => c.data.toJSON());
}
