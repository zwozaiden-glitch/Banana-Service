import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * Resolves a path from the environment.
 * Absolute paths (e.g. a Railway volume mount at `/data`) are used verbatim;
 * relative paths (e.g. `./data/scripts`) resolve against the process cwd.
 */
function resolvePath(envValue, fallback) {
  if (!envValue || String(envValue).trim() === '') return fallback;
  return path.resolve(String(envValue).trim());
}

/**
 * Single configurable data root so every writable artifact (database, scripts,
 * transcripts, backups) can be relocated onto a persistent volume together.
 * On ephemeral-filesystem hosts (Railway, Render, Fly) this MUST point at a
 * mounted volume, or all state is lost on every redeploy.
 */
const dataDir = resolvePath(process.env.DATA_DIR, path.join(rootDir, 'data'));

export const config = {
  // Bot Credentials
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  devGuildId: process.env.DEV_GUILD_ID || null,

  // Branding & Theme
  branding: {
    name: 'Banana Service',
    defaultColor: process.env.DEFAULT_EMBED_COLOR || '#FFE135', // Vibrant Banana Yellow
    accentGold: '#F7B731',
    darkBg: '#1E1E24',
    offWhite: '#FAF0CA',
    successColor: '#10B981',
    warningColor: '#F59E0B',
    errorColor: '#EF4444',
    infoColor: '#3B82F6',
    statusText: process.env.BOT_STATUS_TEXT || '🍌 Serving Banana Scripts | /help',
    statusType: process.env.BOT_STATUS_TYPE || 'Watching',
    defaultFooter: 'Banana Service • Premium Discord Suite 🍌',
    avatarPath: path.join(rootDir, 'assets', 'banana_service_logo.png'),
    bannerPath: path.join(rootDir, 'assets', 'banana_service_banner.png'),
  },

  // Storage & Files
  storage: {
    dataDir,
    dbPath: resolvePath(process.env.DATABASE_PATH, path.join(dataDir, 'banana_service.db')),
    scriptsDir: resolvePath(process.env.STORAGE_DIR, path.join(dataDir, 'scripts')),
    transcriptsDir: resolvePath(process.env.TRANSCRIPTS_DIR, path.join(dataDir, 'transcripts')),
    backupsDir: resolvePath(process.env.BACKUPS_DIR, path.join(dataDir, 'backups')),
    maxScriptSizeBytes: (parseInt(process.env.MAX_SCRIPT_SIZE_MB, 10) || 8) * 1024 * 1024,
    defaultAllowedExtensions: ['.lua', '.txt', '.json', '.cfg', '.ini', '.md', '.py', '.js'],
  },

  // YouTube Polling
  youtube: {
    pollIntervalSeconds: parseInt(process.env.YOUTUBE_CHECK_INTERVAL_SECONDS, 10) || 180,
  },

  // Translation Service
  translation: {
    apiUrl: process.env.TRANSLATION_API_URL || 'https://libretranslate.com/translate',
    apiKey: process.env.TRANSLATION_API_KEY || null,
    defaultTargetLang: 'fr',
  },

  // Environment & Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  isDev: process.env.NODE_ENV !== 'production',
};
