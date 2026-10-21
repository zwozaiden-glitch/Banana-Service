import test from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase, closeDatabase, getGuildSettings, updateGuildSettings } from '../src/database/db.js';

test('Database Initialization & Schema Validation', async (t) => {
  const db = getDatabase(':memory:');

  await t.test('All essential tables exist in schema', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
    const expected = [
      'guild_settings',
      'scripts',
      'script_versions',
      'script_panels',
      'youtube_trackers',
      'giveaways',
      'giveaway_entries',
      'giveaway_winners',
      'tickets',
      'ticket_categories',
      'ticket_settings',
      'verification_settings',
      'welcome_settings',
      'feedback',
      'role_panels',
      'audit_logs',
      'auto_responses',
      'custom_commands',
    ];

    for (const table of expected) {
      assert.ok(tables.includes(table), `Table ${table} should exist in schema`);
    }
  });

  await t.test('Guild settings can be created and updated', () => {
    const testGuildId = `test_guild_${Date.now()}_${Math.random()}`;
    const settings = getGuildSettings(testGuildId);
    assert.equal(settings.guild_id, testGuildId);
    assert.equal(settings.embed_color, '#FFE135');

    const updated = updateGuildSettings(testGuildId, {
      embed_color: '#F7B731',
      footer_text: 'Custom Banana Footer',
    });

    assert.equal(updated.embed_color, '#F7B731');
    assert.equal(updated.footer_text, 'Custom Banana Footer');
  });
});
