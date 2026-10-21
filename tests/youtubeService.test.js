import test from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase } from '../src/database/db.js';
import { YouTubeService } from '../src/services/youtubeService.js';

const channelId = `UC${'A'.repeat(22)}`;

function makeFeed(videos, channelTitle = 'Banana Creator') {
  const entries = videos.map(({ id, title }) => `
    <entry>
      <yt:videoId>${id}</yt:videoId>
      <title>${title}</title>
      <link rel="alternate" href="https://www.youtube.com/watch?v=${id}" />
      <published>2026-10-21T00:00:00+00:00</published>
      <media:group>
        <media:thumbnail url="https://i.ytimg.com/vi/${id}/hqdefault.jpg" />
        <media:description>Video description for ${title}</media:description>
      </media:group>
    </entry>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:yt="http://www.youtube.com/xml/schemas/2015"
      xmlns:media="http://search.yahoo.com/mrss/">
      <title>${channelTitle}</title>
      ${entries}
    </feed>`;
}

function fakeDiscordClient(guildId, discordChannelId, send) {
  const channel = {
    isTextBased: () => true,
    send,
  };
  const guild = {
    channels: {
      cache: new Map([[discordChannelId, channel]]),
      fetch: async id => {
        if (id !== discordChannelId) throw new Error('Unknown test Discord channel');
        return channel;
      },
    },
  };
  return {
    guilds: {
      cache: new Map([[guildId, guild]]),
      fetch: async id => {
        if (id !== guildId) throw new Error('Unknown test Discord guild');
        return guild;
      },
    },
  };
}

test('YouTube Tracker automatic alerts, persistence, retries and mention safety', async (t) => {
  const db = getDatabase();
  const guildId = `yt_test_guild_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const discordChannelId = `yt_test_discord_channel_${Date.now()}`;
  const pingRoleId = '987654321098765432';
  const originalFetch = globalThis.fetch;
  let retryGuildId = null;
  let currentFeed = makeFeed([{ id: 'oldVideo001', title: 'Existing video' }]);

  globalThis.fetch = async () => ({
    ok: true,
    text: async () => currentFeed,
  });
  t.after(() => {
    globalThis.fetch = originalFetch;
    YouTubeService.pollInProgress = false;
    const guildIds = [guildId, retryGuildId].filter(Boolean);
    const placeholders = guildIds.map(() => '?').join(', ');
    db.prepare(`DELETE FROM youtube_trackers WHERE guild_id IN (${placeholders})`).run(...guildIds);
    db.prepare(`DELETE FROM guild_settings WHERE guild_id IN (${placeholders})`).run(...guildIds);
  });

  const sent = [];
  const client = fakeDiscordClient(guildId, discordChannelId, async payload => {
    sent.push(payload);
    return { id: `message_${sent.length}` };
  });

  await t.test('Adding a channel stores the latest existing video as the starting point', async () => {
    const added = await YouTubeService.addTracker(
      guildId,
      channelId,
      discordChannelId,
      pingRoleId,
      '🍌 New upload! @everyone'
    );

    assert.equal(added.channelId, channelId);
    assert.equal(added.channelTitle, 'Banana Creator');
    const row = db.prepare('SELECT last_video_id FROM youtube_trackers WHERE guild_id = ? AND channel_id = ?')
      .get(guildId, channelId);
    assert.equal(row.last_video_id, 'oldVideo001');
    assert.equal(sent.length, 0, 'Adding a tracker should not announce an old upload');
  });

  await t.test('The poller announces every unseen feed entry once, in upload order', async () => {
    currentFeed = makeFeed([
      { id: 'newVideo002', title: 'Second new upload' },
      { id: 'newVideo001', title: 'First new upload' },
      { id: 'oldVideo001', title: 'Existing video' },
    ]);

    await YouTubeService.checkTrackers(client);

    assert.equal(sent.length, 2);
    const announcedTitles = sent.map(message => message.embeds[0].toJSON().title);
    assert.match(announcedTitles[0], /First new upload/);
    assert.match(announcedTitles[1], /Second new upload/);
    assert.ok(sent[0].content.startsWith(`<@&${pingRoleId}>`));
    assert.deepEqual(sent[0].allowedMentions.parse, []);
    assert.deepEqual(sent[0].allowedMentions.roles, [pingRoleId]);

    const row = db.prepare('SELECT last_video_id FROM youtube_trackers WHERE guild_id = ? AND channel_id = ?')
      .get(guildId, channelId);
    assert.equal(row.last_video_id, 'newVideo002');

    await YouTubeService.checkTrackers(client);
    assert.equal(sent.length, 2, 'A repeated poll must not duplicate already delivered alerts');
  });

  await t.test('Failed Discord delivery does not consume the video; next poll retries', async t2 => {
    t2.mock.method(console, 'error', () => {});
    retryGuildId = `${guildId}_retry`;
    const retryChannelId = `${discordChannelId}_retry`;
    currentFeed = makeFeed([{ id: 'oldVideo001', title: 'Existing video' }]);
    await YouTubeService.addTracker(retryGuildId, channelId, retryChannelId);

    currentFeed = makeFeed([
      { id: 'newVideo001', title: 'Retry this upload' },
      { id: 'oldVideo001', title: 'Existing video' },
    ]);

    let shouldFail = true;
    const retrySent = [];
    const retryClient = fakeDiscordClient(retryGuildId, retryChannelId, async payload => {
      if (shouldFail) {
        shouldFail = false;
        throw new Error('Temporary Discord send failure');
      }
      retrySent.push(payload);
      return { id: 'retry_success' };
    });

    await YouTubeService.checkTrackers(retryClient);
    let row = db.prepare('SELECT last_video_id FROM youtube_trackers WHERE guild_id = ? AND channel_id = ?')
      .get(retryGuildId, channelId);
    assert.equal(row.last_video_id, 'oldVideo001');

    await YouTubeService.checkTrackers(retryClient);
    row = db.prepare('SELECT last_video_id FROM youtube_trackers WHERE guild_id = ? AND channel_id = ?')
      .get(retryGuildId, channelId);
    assert.equal(row.last_video_id, 'newVideo001');
    assert.equal(retrySent.length, 1);
  });
});
