# 🍌 Banana Service — Discord Bot

[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-FFE135?logo=node.js&logoColor=black)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14.17-5865F2?logo=discord&logoColor=white)](https://discord.js.org/)
[![Database](https://img.shields.io/badge/Database-SQLite%20(WAL)-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Banana Service** is a high-performance, production-ready Discord bot engineered for **Script Management**, **Interactive Script Hub Panels**, **Automated YouTube Video Tracking**, **Customizable Support Tickets**, **Giveaways**, **Member Verification Gates**, **Real-Time Translation**, and **Server Administration**.

---

## 🌟 Key Features

### 📜 1. Script Management System
- **Supported File Types**: Safely upload and distribute `.lua`, `.txt`, `.json`, `.cfg`, `.ini`, `.py`, and administrator-approved file extensions.
- **Security & Sandboxing**: Strict file path traversal prevention, hash validation (`SHA-256`), size quota enforcement (configurable up to 25MB), and safe sandboxed storage (uploaded scripts are never executed on host).
- **Versioning & Rollback**: Automatic version history tracking for every update. Roll back to any historical release with one command (`/script rollback`).
- **Interactive Script Hub Panels**: Publish persistent interactive panels (`/panel publish`) with **Browse**, **Search**, **Download**, **Versions**, and **Submit** buttons that survive bot restarts.
- **Fast Configuration (`/setscript`)**: Instantly bind, name, categorize, and deploy scripts with custom role requirements.

### 📢 2. Automated Announcements & YouTube Tracker
- **Automatic Script Release Updates**: When a new script is uploaded or updated, Banana Service automatically broadcasts a release embed to designated channels with changelogs and instant download buttons.
- **YouTube Video Tracker**: Periodically monitors YouTube channels via RSS feeds or YouTube Data API v3. Eliminates duplicate alerts by tracking last processed video IDs in persistent storage.
- **Rich Server Announcements**: Publish announcements with custom colors, embeds, and role pings (`/announce`).

### 🎫 3. Customizable Support Ticket System
- **Dynamic Categories**: Administrators can add, edit, and reorder categories (`General Support`, `Script Support`, `Bug Reports`, `Billing`, `Partnership`, etc.).
- **Private Ticket Channels**: Automatically configures private channel permissions (creator + support staff).
- **Staff Ticket Controls**: Claim, close, reopen, rename, add/remove users, and delete channels.
- **Dual Format Transcripts**: Exports clean HTML transcripts (Discord dark theme layout) and plain text logs saved directly to disk and sent to archive channels.

### 🎉 4. Persistent Giveaway Suite
- **Crash-Resilient Timers**: Giveaways automatically resume and countdown correctly across bot restarts.
- **Eligibility Checks**: Enforce role requirements, minimum account age, and minimum server membership days.
- **Fair Random Selection & Rerolls**: Cryptographically fair winner selection with instant reroll capabilities.

### 🛡️ 5. Member Verification & Welcome System
- **Anti-Bot Verification**: Publish verification gates with direct button clicks or interactive math challenge modals.
- **Role Assignment**: Seamlessly grants verified roles and strips unverified visitor roles.
- **Custom Welcome & Goodbye Embeds**: Dynamic placeholders (`{user}`, `{username}`, `{server}`, `{member_count}`) with automatic role assignment on join.

### 🌐 6. Code-Preserving Translation System
- **Multi-Engine Backend**: LibreTranslate API with fallback to high-reliability translation endpoints.
- **Format Preservation**: Automatically extracts and protects code blocks (`` `code` ``, ```` ```code``` ````), URLs, user/role mentions (`<@id>`), and custom Discord emojis so syntax remains untouched.
- **Slash & Context Menu**: Translate via `/translate` or right-clicking any message -> *Apps* -> *Translate to French*.

### 🔨 7. Moderation & Server Administration
- Full moderation toolkit: `/ban`, `/kick`, `/timeout`, `/warn`, `/warnings`, `/purge`, `/slowmode`, `/modlogs`.
- Self-assignable role panels (`/role panel`) and autoroles (`/role autorole`).
- Auto-responses (`/autoresponse`) with cooldowns and custom text commands (`/customcmd`).
- Theme branding customizer (`/branding`) allowing servers to change the bot's embed color, footer, and emojis.
- Database backup snapshot generator (`/backup`).

---

## 🏗️ Project Architecture

```
Banana-Service/
├── assets/                     # Banana Service brand assets (vector SVG)
│   ├── banana_service_logo.svg # Bot avatar / application icon
│   └── banana_service_banner.svg # Server banner artwork
├── data/                       # Persistent storage (auto-created)
│   ├── banana_service.db       # SQLite database (WAL mode)
│   ├── scripts/                # Uploaded script storage
│   ├── transcripts/            # Ticket transcripts (HTML & TXT)
│   └── backups/                # Database snapshots
├── src/
│   ├── index.js                # Bot entrypoint & lifecycle management
│   ├── config.js               # Environment configuration & defaults
│   ├── deploy-commands.js      # REST Slash command registration
│   ├── database/
│   │   ├── db.js               # Database connection & connection pool
│   │   └── schema.js           # SQL DDL schemas and indexes
│   ├── services/
│   │   ├── scriptService.js    # Script CRUD, versions, & rollback
│   │   ├── panelService.js     # Script hub panel builder
│   │   ├── announcementService.js # Script release auto-announcements
│   │   ├── youtubeService.js   # YouTube poller & feed parser
│   │   ├── giveawayService.js  # Giveaway scheduler & entry tracker
│   │   ├── ticketService.js    # Private ticket channels & management
│   │   ├── translationService.js # Multi-engine translation & tokenization
│   │   ├── verificationService.js# Verification challenge gate
│   │   ├── welcomeService.js   # Welcome/goodbye greetings & autoroles
│   │   ├── feedbackService.js  # Feedback & script bug reports
│   │   └── moderationService.js# Moderation enforcement & modlogs
│   ├── utils/
│   │   ├── embeds.js           # Banana Service embed theme builder
│   │   ├── emojis.js           # Fallback-aware emoji resolver
│   │   ├── permissions.js      # Centralized permission & hierarchy checks
│   │   ├── fileValidator.js    # Path traversal protection & file safety
│   │   ├── transcriptGenerator.js # Discord-style HTML transcript builder
│   │   └── auditLogger.js      # SQLite audit trail
│   ├── commands/               # Modular slash command definitions
│   └── events/                 # Discord client event listeners
├── tests/                      # Automated test suite (node:test)
├── .env.example
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: Version `20.x` or `22.x` (LTS recommended)
- **npm**: Version `10.x` or later

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/zwozaiden-glitch/Banana-Service.git
cd Banana-Service
npm install
```

### 2. Discord Developer Portal Setup
1. Visit the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application**, name it **Banana Service**, and create it.
3. Navigate to **Bot** on the left menu:
   - Click **Reset Token** and copy your **Bot Token**.
   - Under **Privileged Gateway Intents**, enable:
     - ✅ **Server Members Intent** (Required for welcome greetings, autoroles, verification)
     - ✅ **Message Content Intent** (Required for auto-responses & custom text commands)
4. Navigate to **OAuth2**:
   - Copy your **Client ID** (Application ID).
   - Under **OAuth2 URL Generator**, select scopes: `bot`, `applications.commands`.
   - Select bot permissions: `Administrator` (or `Manage Channels`, `Manage Roles`, `Send Messages`, `Embed Links`, `Attach Files`, `Moderate Members`, `Ban Members`, `Kick Members`).
   - Copy the generated URL and authorize the bot into your Discord server.

### 3. Environment Configuration
Copy the template configuration file:
```bash
cp .env.example .env
```

Open `.env` and fill in your values:
```env
# Required Discord Credentials
DISCORD_TOKEN=MTE5OT...your_discord_bot_token_here...
CLIENT_ID=123456789012345678

# Optional: Instant Guild Registration (Leave blank for global deployment)
DEV_GUILD_ID=123456789012345678

# Storage & Database
DATABASE_PATH=./data/banana_service.db
STORAGE_DIR=./data/scripts
MAX_SCRIPT_SIZE_MB=8

# Branding
DEFAULT_EMBED_COLOR=#FFE135
BOT_STATUS_TEXT=🍌 Serving Banana Scripts | /help

# YouTube Poller (Checks every 180 seconds by default)
YOUTUBE_CHECK_INTERVAL_SECONDS=180
YOUTUBE_API_KEY=

# Translation
TRANSLATION_API_URL=https://libretranslate.com/translate
TRANSLATION_API_KEY=
```

### 4. Register Slash Commands
Register all slash and context menu commands with Discord:

```bash
# Register commands to your test server instantly:
npm run deploy:guild

# Or register globally to all servers:
npm run deploy
```

### 5. Start the Bot
Run the bot in production mode:
```bash
npm start
```

Or run in development mode with automatic restart on file changes:
```bash
npm run dev
```

---

## 🧪 Running Automated Tests

Banana Service ships a native `node:test` suite (no extra test framework required) covering seven areas: the SQLite schema, file security, script versioning/rollback, giveaway persistence, ticket categories, translation tokenisation, and the command registry.

```bash
npm test
```

Current results — **33 assertions across 7 suites, all passing**:

```
✔ Slash Command Registry Integrity (6 subtests)
  ✔ Every command exposes data + execute handler
  ✔ All commands serialize to valid Discord API JSON
  ✔ Message context menu translation command is registered
  ✔ No duplicate command names registered
  ✔ Collection loader maps every command by name
  ✔ Core feature commands from requirements are present
  ✔ Subcommand option descriptions stay within Discord limits
✔ Database Initialization & Schema Validation (2 subtests)
  ✔ All essential tables exist in schema (18 tables)
  ✔ Guild settings can be created and updated
✔ File Security & Path Traversal Protections (5 subtests)
  ✔ Allows approved file extensions (.lua, .txt, .json)
  ✔ Rejects dangerous or unapproved file extensions (.exe, .sh, .bat)
  ✔ Sanitizes filenames and blocks directory traversal attempts
  ✔ Safe storage path generates within designated directory
  ✔ assertPathInStorage blocks access outside scripts directory
✔ GiveawayService Entries & Persistence (3 subtests)
  ✔ Records user entries in database
  ✔ Prevents duplicate entries from same user in DB
  ✔ Cancels giveaway and persists ended state
✔ ScriptService CRUD, Versioning & Rollback (6 subtests)
  ✔ Uploads a new valid Lua script
  ✔ Rejects duplicate script names/slugs in the same guild
  ✔ Updates script with version 1.1.0 and records changelog
  ✔ Lists scripts with category filter
  ✔ Rollbacks script to version 1.0.0
  ✔ Deletes script and cleans up version files
✔ TicketService Customizable Categories & Settings (2 subtests)
  ✔ Initializes default ticket categories for new server
  ✔ Supports custom category addition and reordering
✔ Translation Tokenization & Code Preservation (1 subtest)
  ✔ Protects code blocks, inline code, URLs, and Discord mentions

# tests 33
# pass 33
# fail 0
```

---

## 📋 Complete Command Reference

| Category | Command | Description |
| :--- | :--- | :--- |
| **Scripts** | `/script list` | Browse server script repository with filters and pagination |
| | `/script upload` | Upload a new `.lua`, `.txt`, or `.json` script file |
| | `/script update` | Release a new version with changelog |
| | `/script info` | Inspect metadata, uploader, and version history |
| | `/script download` | Download the script file directly |
| | `/script versions` | View historical releases |
| | `/script rollback` | Restore a previous version |
| | `/setscript` | Quick-configure a script with name, file, role, & channel |
| | `/panel publish` | Publish interactive Script Hub with buttons |
| | `/panel refresh` | Refresh an active Script Hub panel |
| | `/updates enable` | Enable automatic announcements for script releases |
| **YouTube** | `/youtube add` | Monitor a YouTube channel for new video uploads |
| | `/youtube remove` | Stop tracking a YouTube channel |
| | `/youtube list` | View all tracked channels |
| **Tickets** | `/ticket panel` | Publish interactive ticket department selection panel |
| | `/ticket close` | Close ticket, generate HTML transcript, and archive |
| | `/ticket add / remove` | Manage ticket channel collaborators |
| | `/ticket rename` | Rename ticket channel |
| | `/ticket category_add`| Add custom ticket category (slug, label, emoji, role) |
| **Giveaways**| `/giveaway create` | Launch a giveaway with duration, winners, and roles |
| | `/giveaway end` | Conclude an active giveaway immediately |
| | `/giveaway reroll` | Select new random winners |
| | `/giveaway cancel` | Terminate giveaway |
| **Gates** | `/verify setup` | Deploy anti-bot verification gate (button or math modal) |
| | `/welcome setup` | Configure welcome/goodbye channels and autoroles |
| **Translation**| `/translate` | Translate text into French (or 11 others) preserving code |
| | *Apps -> Translate* | Message context menu translation |
| **Moderation**| `/ban` / `/kick` | Remove rule-breakers with hierarchy safety |
| | `/timeout` | Temporarily mute a member |
| | `/warn` / `/warnings` | Issue and view recorded infractions |
| | `/purge` | Bulk delete messages |
| | `/slowmode` | Adjust channel chat cooldown |
| | `/role panel` | Deploy self-assignable role buttons |
| | `/role autorole` | Configure automatic join roles |
| | `/modlogs` | View server audit log entries |
| **Utility** | `/help` | Interactive command manual with category selector |
| | `/ping` / `/uptime` | Inspect WebSocket heartbeat and process uptime |
| | `/botinfo` | View system specs and memory consumption |
| | `/serverinfo` | View server stats and boost status |
| | `/poll` | Launch interactive emoji poll |
| | `/remind` | Schedule a timed personal reminder |
| | `/suggest` | Submit an idea or feedback |
| **Admin** | `/setup` | Quick-start wizard for channels and staff roles |
| | `/branding` | Customize server embed color, emojis, and footer |
| | `/backup` | Export instant snapshot of database |
| | `/autoresponse` | Configure automated keyword replies |
| | `/customcmd` | Create custom chat commands (e.g. `!rules`) |

---

## 🔒 Security & Reliability Guarantees

1. **No Code Execution**:
   - Uploaded Lua and text files are stored as static assets in `data/scripts/<guild_id>/`.
   - Files are never evaluated, executed, or compiled on the host operating system.
2. **Path Traversal Protection**:
   - Filenames are sanitized via `path.basename` and regex stripping.
   - Any attempt to include `..`, `/`, `\`, or null bytes (`\0`) is blocked immediately.
   - All file operations pass through `assertPathInStorage()`.
3. **Database Concurrency & Durability**:
   - SQLite Write-Ahead Logging (`WAL`) mode is enabled.
   - WAL allows concurrent readers and writes without database lock contention.
4. **Discord Role Hierarchy**:
   - The bot validates whether its highest role is above targeted members before moderation actions.
   - Prevents unauthorized elevation or permission bypasses.
5. **Deduplication**:
   - YouTube poller and giveaway entries use SQLite `UNIQUE` constraints to eliminate duplicate alerts and duplicate entries.

---

## 🚀 Production Deployment (PM2 / Systemd)

### Using PM2 (Recommended)
Install PM2 globally:
```bash
npm install -g pm2
```

Start Banana Service as a persistent daemon:
```bash
pm2 start src/index.js --name "banana-service"
pm2 save
pm2 startup
```

Monitor logs:
```bash
pm2 logs banana-service
```

### Using Systemd Service
Create `/etc/systemd/system/banana-service.service`:
```ini
[Unit]
Description=Banana Service Discord Bot
After=network.target

[Service]
Type=simple
User=user
WorkingDirectory=/home/user/Banana-Service
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
EnvironmentFile=/home/user/Banana-Service/.env

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable banana-service
sudo systemctl start banana-service
```

---

## 🍌 Brand Assets
Banana Service ships vector brand artwork in `assets/` (no raster/binary blobs, so they stay tiny in git and scale to any size):
- `assets/banana_service_logo.svg`: Banana Service bot avatar (banana-yellow `#FFE135` tile, banana crescent + terminal prompt glyph). Export to PNG at 512×512 for the Discord application icon.
- `assets/banana_service_banner.svg`: Charcoal `#111827` server banner with golden accents and feature chips. Export to 960×540 PNG for the Discord server banner.

Both are plain SVG source, so recoloring is a one-line edit — swap `#FFE135` for your guild's brand color.

---

## 📄 License
Banana Service is open source software released under the [MIT License](LICENSE).
