import test from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase } from '../src/database/db.js';
import { GiveawayService } from '../src/services/giveawayService.js';

test('GiveawayService Entries & Persistence', async (t) => {
  const db = getDatabase();
  const guildId = `guild_giveaways_${Date.now()}`;
  const messageId = `msg_${Date.now()}_${Math.random()}`;

  // Seed test giveaway
  const insert = db.prepare(`
    INSERT INTO giveaways (guild_id, channel_id, message_id, prize, winner_count, ends_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const info = insert.run(guildId, 'c1', messageId, 'Nitro 1 Year', 2, Date.now() + 60000, 'u1');
  const giveawayId = info.lastInsertRowid;

  await t.test('Records user entries in database', () => {
    db.prepare('INSERT INTO giveaway_entries (giveaway_id, user_id) VALUES (?, ?)').run(giveawayId, 'user_a');
    db.prepare('INSERT INTO giveaway_entries (giveaway_id, user_id) VALUES (?, ?)').run(giveawayId, 'user_b');
    db.prepare('INSERT INTO giveaway_entries (giveaway_id, user_id) VALUES (?, ?)').run(giveawayId, 'user_c');

    const entries = db.prepare('SELECT user_id FROM giveaway_entries WHERE giveaway_id = ?').all(giveawayId);
    assert.equal(entries.length, 3);
  });

  await t.test('Prevents duplicate entries from same user in DB', () => {
    assert.throws(() => {
      db.prepare('INSERT INTO giveaway_entries (giveaway_id, user_id) VALUES (?, ?)').run(giveawayId, 'user_a');
    });
  });

  await t.test('Cancels giveaway and persists ended state', () => {
    GiveawayService.cancelGiveaway(giveawayId);
    const updated = db.prepare('SELECT ended FROM giveaways WHERE id = ?').get(giveawayId);
    assert.equal(updated.ended, 1);
  });
});
