export const SCHEMA_SQL = `
-- Guild Core Settings & Branding
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  embed_color TEXT DEFAULT '#FFE135',
  default_emoji TEXT DEFAULT '🍌',
  footer_text TEXT DEFAULT 'Banana Service • Premium Discord Suite 🍌',
  footer_icon TEXT,
  script_channel_id TEXT,
  announce_channel_id TEXT,
  modlog_channel_id TEXT,
  staff_role_id TEXT,
  script_roles TEXT DEFAULT '[]', -- JSON array of role IDs allowed to upload/manage
  allowed_extensions TEXT DEFAULT '[]', -- JSON array of allowed file extensions
  custom_emojis TEXT DEFAULT '{}', -- JSON map of key -> emoji
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scripts Master Table
CREATE TABLE IF NOT EXISTS scripts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'General',
  version TEXT DEFAULT '1.0.0',
  current_filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  file_hash TEXT,
  uploader_id TEXT NOT NULL,
  uploader_tag TEXT,
  access_role_id TEXT,
  target_channel_id TEXT,
  is_private INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guild_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_scripts_guild ON scripts(guild_id);
CREATE INDEX IF NOT EXISTS idx_scripts_category ON scripts(guild_id, category);

-- Script Versions History
CREATE TABLE IF NOT EXISTS script_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  script_id INTEGER NOT NULL,
  version TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  changelog TEXT,
  file_size INTEGER DEFAULT 0,
  file_hash TEXT,
  uploader_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(script_id) REFERENCES scripts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_script_versions ON script_versions(script_id);

-- Script Interactive Panels
CREATE TABLE IF NOT EXISTS script_panels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL UNIQUE,
  title TEXT DEFAULT '🍌 Banana Service — Script Hub',
  description TEXT,
  color TEXT DEFAULT '#FFE135',
  banner_url TEXT,
  category_filter TEXT,
  allowed_roles TEXT DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- YouTube Trackers
CREATE TABLE IF NOT EXISTS youtube_trackers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL, -- YouTube channel ID (e.g. UC...)
  channel_name TEXT NOT NULL,
  channel_url TEXT,
  discord_channel_id TEXT NOT NULL,
  ping_role_id TEXT,
  custom_message TEXT,
  last_video_id TEXT,
  last_checked_at TIMESTAMP,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guild_id, channel_id)
);

-- Automatic Script Updates Config
CREATE TABLE IF NOT EXISTS update_announcement_settings (
  guild_id TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 1,
  channel_id TEXT NOT NULL,
  ping_role_id TEXT,
  categories TEXT DEFAULT '[]', -- JSON array of categories that trigger updates (empty = all)
  include_download_button INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Giveaways
CREATE TABLE IF NOT EXISTS giveaways (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL UNIQUE,
  prize TEXT NOT NULL,
  winner_count INTEGER DEFAULT 1,
  required_role_id TEXT,
  min_account_age_days INTEGER DEFAULT 0,
  min_membership_days INTEGER DEFAULT 0,
  sponsor TEXT,
  description TEXT,
  ends_at INTEGER NOT NULL, -- Unix timestamp ms
  ended INTEGER DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Giveaway Entries
CREATE TABLE IF NOT EXISTS giveaway_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  giveaway_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  entered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(giveaway_id, user_id),
  FOREIGN KEY(giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE
);

-- Giveaway Winners
CREATE TABLE IF NOT EXISTS giveaway_winners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  giveaway_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  is_reroll INTEGER DEFAULT 0,
  picked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE
);

-- Ticket Master Settings
CREATE TABLE IF NOT EXISTS ticket_settings (
  guild_id TEXT PRIMARY KEY,
  panel_channel_id TEXT,
  panel_message_id TEXT,
  log_channel_id TEXT,
  transcript_channel_id TEXT,
  naming_scheme TEXT DEFAULT 'ticket-{number}',
  max_open_tickets INTEGER DEFAULT 3,
  claim_enabled INTEGER DEFAULT 1,
  priority_enabled INTEGER DEFAULT 1,
  staff_role_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dynamic Ticket Categories
CREATE TABLE IF NOT EXISTS ticket_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  emoji TEXT DEFAULT '🍌',
  support_role_id TEXT,
  discord_category_id TEXT, -- Discord parent channel category
  welcome_message TEXT,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(guild_id, slug)
);

-- Active & Closed Tickets
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT UNIQUE,
  ticket_num INTEGER NOT NULL,
  category_id INTEGER,
  creator_id TEXT NOT NULL,
  claimed_by TEXT,
  status TEXT DEFAULT 'open', -- open, closed, deleted
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
  close_reason TEXT,
  closed_by TEXT,
  closed_at TIMESTAMP,
  transcript_path TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(category_id) REFERENCES ticket_categories(id) ON DELETE SET NULL
);

-- Verification Settings
CREATE TABLE IF NOT EXISTS verification_settings (
  guild_id TEXT PRIMARY KEY,
  channel_id TEXT,
  message_id TEXT,
  verified_role_id TEXT,
  unverified_role_id TEXT,
  challenge_type TEXT DEFAULT 'button', -- button, math, captcha
  instructions TEXT DEFAULT 'Click the verify button below to gain access to the server!',
  is_enabled INTEGER DEFAULT 0
);

-- Welcome & Goodbye System
CREATE TABLE IF NOT EXISTS welcome_settings (
  guild_id TEXT PRIMARY KEY,
  welcome_channel_id TEXT,
  goodbye_channel_id TEXT,
  welcome_title TEXT DEFAULT '🍌 Welcome to {server}!',
  welcome_message TEXT DEFAULT 'Hey {user}, welcome to the server! You are member #{member_count}. Enjoy your stay! 🍌✨',
  goodbye_title TEXT DEFAULT '👋 Goodbye from {server}',
  goodbye_message TEXT DEFAULT '{username} has left the server. We hope to see you again! 🍌',
  embed_color TEXT DEFAULT '#FFE135',
  auto_role_id TEXT,
  is_enabled INTEGER DEFAULT 1
);

-- Feedback Submissions
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  type TEXT DEFAULT 'general', -- general, script
  script_id INTEGER,
  user_id TEXT NOT NULL,
  user_tag TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  rating INTEGER, -- 1-5
  status TEXT DEFAULT 'pending', -- pending, accepted, rejected, in_progress, completed
  staff_notes TEXT,
  staff_id TEXT,
  channel_id TEXT,
  message_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(script_id) REFERENCES scripts(id) ON DELETE SET NULL
);

-- Role Panels & Self-Roles
CREATE TABLE IF NOT EXISTS role_panels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL UNIQUE,
  title TEXT DEFAULT '🍌 Role Selection',
  description TEXT DEFAULT 'Choose your roles below:',
  panel_type TEXT DEFAULT 'buttons', -- buttons, select
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_panel_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  panel_id INTEGER NOT NULL,
  role_id TEXT NOT NULL,
  label TEXT NOT NULL,
  emoji TEXT DEFAULT '🍌',
  description TEXT,
  FOREIGN KEY(panel_id) REFERENCES role_panels(id) ON DELETE CASCADE
);

-- Auto Roles for New Members
CREATE TABLE IF NOT EXISTS autoroles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  UNIQUE(guild_id, role_id)
);

-- Moderation Warnings & Logs
CREATE TABLE IF NOT EXISTS moderation_warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Auto-responses
CREATE TABLE IF NOT EXISTS auto_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  trigger_phrase TEXT NOT NULL,
  response_text TEXT NOT NULL,
  match_type TEXT DEFAULT 'contains', -- exact, contains, startswith
  cooldown_seconds INTEGER DEFAULT 5,
  allowed_channels TEXT DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Custom Commands
CREATE TABLE IF NOT EXISTS custom_commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  command_name TEXT NOT NULL,
  response_text TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guild_id, command_name)
);

-- Audit Trail
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;
