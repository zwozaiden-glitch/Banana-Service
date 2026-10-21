import { XMLParser } from 'fast-xml-parser';
import { getDatabase, getGuildSettings } from '../database/db.js';
import { createBananaEmbed } from '../utils/embeds.js';
import { getGuildEmoji } from '../utils/emojis.js';
import { config } from '../config.js';

export class YouTubeService {
  static pollerInterval = null;
  static pollerTimeout = null;
  static pollInProgress = false;

  /**
   * Resolves a YouTube channel ID from a channel URL, handle, or ID
   */
  static async resolveChannelId(input) {
    if (!input || typeof input !== 'string') {
      throw new Error('Channel URL or ID is required.');
    }

    const trimmed = input.trim();

    // Direct Channel ID (typically starts with UC and 24 chars)
    if (/^UC[a-zA-Z0-9_-]{22}$/.test(trimmed)) {
      return trimmed;
    }

    // Direct URL matching /channel/UC...
    const channelMatch = trimmed.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/);
    if (channelMatch) {
      return channelMatch[1];
    }

    // If handle (@name) or custom url, fetch channel page HTML to extract channel_id
    try {
      const url = trimmed.startsWith('http') ? trimmed : `https://www.youtube.com/${trimmed}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) BananaService/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch YouTube page (Status: ${response.status})`);
      }

      const html = await response.text();
      // Extract channelId from meta tags or canonical URL
      const idMatch = html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/);
      if (idMatch) return idMatch[1];

      const itemPropMatch = html.match(/<meta itemprop="channelId" content="(UC[a-zA-Z0-9_-]{22})"/);
      if (itemPropMatch) return itemPropMatch[1];

      const browseIdMatch = html.match(/"browseId":"(UC[a-zA-Z0-9_-]{22})"/);
      if (browseIdMatch) return browseIdMatch[1];
    } catch (err) {
      console.warn('Could not scrape YouTube channel ID from URL:', err.message);
    }

    throw new Error('Could not resolve YouTube Channel ID. Please provide the direct Channel ID (starts with "UC...") or official channel URL.');
  }

  /**
   * Fetches latest videos from YouTube RSS feed for a channel
   */
  static async fetchChannelFeed(channelId) {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) BananaServiceBot/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`YouTube RSS feed returned status ${response.status}`);
    }

    const xmlData = await response.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });

    const parsed = parser.parse(xmlData);
    if (!parsed || !parsed.feed) {
      throw new Error('Invalid YouTube feed response.');
    }

    const feed = parsed.feed;
    const channelTitle = feed.title || feed.author?.name || 'YouTube Channel';

    let entries = feed.entry;
    if (!entries) return { channelTitle, videos: [] };
    if (!Array.isArray(entries)) entries = [entries];

    const videos = entries.map(entry => {
      const videoId = entry['yt:videoId'];
      const title = entry.title;
      const url = entry.link?.['@_href'] || `https://www.youtube.com/watch?v=${videoId}`;
      const published = entry.published;
      const thumbnail = entry['media:group']?.['media:thumbnail']?.['@_url']
        || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      const description = entry['media:group']?.['media:description'] || '';

      return {
        videoId,
        title,
        url,
        published,
        thumbnail,
        description,
        author: channelTitle,
      };
    });

    return { channelTitle, videos };
  }

  /**
   * Adds a YouTube channel to be tracked in a guild
   */
  static async addTracker(guildId, input, discordChannelId, pingRoleId = null, customMessage = null) {
    const channelId = await this.resolveChannelId(input);
    const feed = await this.fetchChannelFeed(channelId);

    const db = getDatabase();
    const latestVideoId = feed.videos.length > 0 ? feed.videos[0].videoId : null;

    const stmt = db.prepare(`
      INSERT INTO youtube_trackers (
        guild_id, channel_id, channel_name, channel_url, discord_channel_id, ping_role_id, custom_message, last_video_id, last_checked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(guild_id, channel_id) DO UPDATE SET
        discord_channel_id = excluded.discord_channel_id,
        ping_role_id = excluded.ping_role_id,
        custom_message = excluded.custom_message,
        is_active = 1
    `);

    stmt.run(
      guildId,
      channelId,
      feed.channelTitle,
      `https://www.youtube.com/channel/${channelId}`,
      discordChannelId,
      pingRoleId || null,
      customMessage || null,
      latestVideoId
    );

    return {
      channelId,
      channelTitle: feed.channelTitle,
      latestVideoId,
    };
  }

  /**
   * Removes a tracked YouTube channel
   */
  static removeTracker(guildId, channelIdOrName) {
    const db = getDatabase();
    const tracker = db.prepare(`
      SELECT * FROM youtube_trackers
      WHERE guild_id = ? AND (channel_id = ? OR LOWER(channel_name) = LOWER(?))
    `).get(guildId, channelIdOrName, channelIdOrName);

    if (!tracker) {
      throw new Error(`Tracked YouTube channel "${channelIdOrName}" not found.`);
    }

    db.prepare('DELETE FROM youtube_trackers WHERE id = ?').run(tracker.id);
    return tracker;
  }

  /**
   * Lists all tracked channels for a guild
   */
  static listTrackers(guildId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM youtube_trackers WHERE guild_id = ? ORDER BY id ASC').all(guildId);
  }

  /**
   * Checks all active trackers and announces every video still present in the
   * feed since the last successfully delivered announcement. YouTube's RSS feed
   * is newest-first; reverse the unseen slice so posts arrive chronologically.
   */
  static async checkTrackers(client) {
    // A slow RSS request must not let setInterval start a duplicate poll.
    if (this.pollInProgress) return;
    this.pollInProgress = true;

    try {
      const db = getDatabase();
      const activeTrackers = db.prepare('SELECT * FROM youtube_trackers WHERE is_active = 1').all();

      for (const tracker of activeTrackers) {
        try {
          const feed = await this.fetchChannelFeed(tracker.channel_id);
          const videos = (feed.videos || []).filter(video => video.videoId);
          if (videos.length === 0) {
            db.prepare('UPDATE youtube_trackers SET last_checked_at = CURRENT_TIMESTAMP WHERE id = ?').run(tracker.id);
            continue;
          }

          const lastIndex = tracker.last_video_id
            ? videos.findIndex(video => video.videoId === tracker.last_video_id)
            : -1;

          let unseenVideos;
          if (lastIndex >= 0) {
            // RSS is newest-first; only entries before the saved ID are new.
            unseenVideos = videos.slice(0, lastIndex).reverse();
          } else {
            // If the stored ID has aged out of YouTube's RSS window, announce
            // the newest upload only rather than replaying an unknown backlog.
            unseenVideos = videos[0].videoId === tracker.last_video_id ? [] : [videos[0]];
          }

          for (const video of unseenVideos) {
            const delivered = await this.postVideoNotification(client, tracker, video);
            // Keep the last successfully delivered ID so transient Discord
            // permission/network failures are retried on the next poll.
            if (!delivered) break;

            db.prepare(`
              UPDATE youtube_trackers
              SET last_video_id = ?, last_checked_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(video.videoId, tracker.id);
          }

          db.prepare('UPDATE youtube_trackers SET last_checked_at = CURRENT_TIMESTAMP WHERE id = ?').run(tracker.id);
        } catch (err) {
          console.warn(`[YouTube Tracker] Error checking channel ${tracker.channel_name} (${tracker.channel_id}):`, err.message);
        }
      }
    } finally {
      this.pollInProgress = false;
    }
  }

  /**
   * Posts a formatted video announcement. Returns true only after Discord accepts
   * the message, allowing failed deliveries to be retried on the next poll.
   */
  static async postVideoNotification(client, tracker, video) {
    try {
      const guild = client.guilds.cache.get(tracker.guild_id) || await client.guilds.fetch(tracker.guild_id).catch(() => null);
      if (!guild) return false;

      const channel = guild.channels.cache.get(tracker.discord_channel_id) || await guild.channels.fetch(tracker.discord_channel_id).catch(() => null);
      if (!channel || !channel.isTextBased()) return false;

      const guildSettings = getGuildSettings(tracker.guild_id);
      const banana = getGuildEmoji(guildSettings, 'banana');
      const ytEmoji = getGuildEmoji(guildSettings, 'youtube');

      const pingText = tracker.ping_role_id ? `<@&${tracker.ping_role_id}>\n` : '';
      const customMessage = tracker.custom_message?.trim();
      const defaultMsg = `${banana} **New video from ${video.author}!**\n\n**${video.title}**\n\n${video.url}`;
      const content = pingText + (customMessage ? `${customMessage}\n${video.url}` : defaultMsg);

      const embed = createBananaEmbed(guildSettings, {
        title: `${ytEmoji} ${video.title}`,
        url: video.url,
        description: video.description ? video.description.slice(0, 300) : `Watch the latest upload from **${video.author}**!`,
        image: video.thumbnail,
        fields: [
          { name: 'Channel', value: `[${video.author}](${tracker.channel_url || video.url})`, inline: true },
          { name: 'Watch', value: `[Click to Watch](${video.url})`, inline: true },
        ],
        color: '#FF0000',
      });

      await channel.send({
        content,
        embeds: [embed],
        // Custom text cannot trigger @everyone or arbitrary user/role mentions;
        // only the explicitly configured notification role may be pinged.
        allowedMentions: {
          parse: [],
          roles: tracker.ping_role_id ? [tracker.ping_role_id] : [],
          users: [],
          repliedUser: false,
        },
      });
      return true;
    } catch (err) {
      console.error(`Failed to post YouTube notification for ${tracker.channel_name}:`, err);
      return false;
    }
  }

  /**
   * Starts periodic polling in the background. The initial timeout is tracked
   * so graceful shutdown can cancel both scheduled jobs cleanly.
   */
  static startPoller(client, intervalSeconds = config.youtube.pollIntervalSeconds) {
    this.stopPoller();
    const parsedInterval = Number.parseInt(intervalSeconds, 10);
    const safeInterval = Number.isFinite(parsedInterval) && parsedInterval > 0
      ? parsedInterval
      : config.youtube.pollIntervalSeconds;

    console.log(`[YouTube Poller] Started with ${safeInterval}s interval.`);

    const runPoll = () => {
      this.checkTrackers(client).catch(err => {
        console.error('[YouTube Poller] Unhandled polling error:', err);
      });
    };

    // Run first check after 10 seconds so the bot finishes its Discord startup.
    this.pollerTimeout = setTimeout(() => {
      this.pollerTimeout = null;
      runPoll();
    }, 10000);

    this.pollerInterval = setInterval(runPoll, safeInterval * 1000);
  }

  static stopPoller() {
    if (this.pollerInterval) {
      clearInterval(this.pollerInterval);
      this.pollerInterval = null;
    }
    if (this.pollerTimeout) {
      clearTimeout(this.pollerTimeout);
      this.pollerTimeout = null;
    }
  }
}
