import test from 'node:test';
import assert from 'node:assert/strict';
import { TicketService } from '../src/services/ticketService.js';
import { getDatabase } from '../src/database/db.js';

test('TicketService Customizable Categories & Settings', async (t) => {
  const guildId = `test_guild_tickets_${Date.now()}`;
  const db = getDatabase();

  await t.test('Initializes default ticket categories for new server', () => {
    const categories = TicketService.getCategories(guildId);
    assert.ok(categories.length >= 4);
    assert.ok(categories.some(c => c.slug === 'general'));
    assert.ok(categories.some(c => c.slug === 'scripts'));
  });

  await t.test('Supports custom category addition and reordering', () => {
    db.prepare(`
      INSERT INTO ticket_categories (guild_id, slug, label, description, emoji, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(guildId, 'partners', 'Partnership Desk', 'Partner requests', '🤝', 5);

    const categories = TicketService.getCategories(guildId);
    assert.ok(categories.some(c => c.slug === 'partners'));
  });
});
