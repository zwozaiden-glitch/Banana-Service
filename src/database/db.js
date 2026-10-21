import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config.js';
import { SCHEMA_SQL } from './schema.js';

let dbInstance = null;

export function getDatabase(customPath = null) {
  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const dbFilePath = customPath || config.storage.dbPath;
  const dbDir = path.dirname(dbFilePath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbFilePath);

  // Enable WAL mode for high concurrency, fast reads/writes and crash resilience
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');

  // Execute schema
  db.exec(SCHEMA_SQL);

  // Seed default ticket categories helper if needed
  if (!customPath) {
    dbInstance = db;
  }

  return db;
}

export function closeDatabase() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
    dbInstance = null;
  }
}

// Helper to get or insert default guild settings
export function getGuildSettings(guildId) {
  const db = getDatabase();
  const selectStmt = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?');
  let settings = selectStmt.get(guildId);

  if (!settings) {
    const insertStmt = db.prepare(`
      INSERT INTO guild_settings (guild_id)
      VALUES (?)
    `);
    insertStmt.run(guildId);
    settings = selectStmt.get(guildId);
  }

  return settings;
}

export function updateGuildSettings(guildId, updates = {}) {
  const db = getDatabase();
  const allowedFields = [
    'embed_color', 'default_emoji', 'footer_text', 'footer_icon',
    'script_channel_id', 'announce_channel_id', 'modlog_channel_id',
    'staff_role_id', 'script_roles', 'allowed_extensions', 'custom_emojis'
  ];

  const keys = Object.keys(updates).filter(k => allowedFields.includes(k));
  if (keys.length === 0) return getGuildSettings(guildId);

  const setClause = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => {
    const val = updates[k];
    if (typeof val === 'object' && val !== null) {
      return JSON.stringify(val);
    }
    return val;
  });

  const query = `
    UPDATE guild_settings
    SET ${setClause}, updated_at = CURRENT_TIMESTAMP
    WHERE guild_id = ?
  `;

  db.prepare(query).run(...values, guildId);
  return getGuildSettings(guildId);
}
