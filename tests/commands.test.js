import test from 'node:test';
import assert from 'node:assert/strict';
import { allCommandsList, getCommandsJson, loadCommands } from '../src/commands/index.js';

/** Discord user (2) and message (3) context menu commands carry no description. */
function isContextMenu(entry) {
  return entry.type === 2 || entry.type === 3;
}

test('Slash Command Registry Integrity', async (t) => {
  await t.test('Every command exposes data + execute handler', () => {
    for (const cmd of allCommandsList) {
      assert.ok(cmd, 'Command module must export a default object');
      assert.ok(cmd.data, `${cmd?.data?.name ?? 'unknown'} is missing .data (SlashCommandBuilder)`);
      assert.equal(typeof cmd.execute, 'function', `${cmd.data.name} must export an execute() function`);
    }
  });

  await t.test('All commands serialize to valid Discord API JSON', () => {
    const json = getCommandsJson();
    assert.ok(Array.isArray(json));
    assert.ok(json.length >= 30, `Expected 30+ registered commands, got ${json.length}`);

    for (const entry of json) {
      assert.equal(typeof entry.name, 'string');
      assert.ok(entry.name.length > 0);

      if (isContextMenu(entry)) {
        // Discord rejects descriptions on user/message context menu commands (type 2 / 3)
        assert.equal(entry.description, undefined, `${entry.name} is a context menu and must not carry a description`);
        assert.ok(entry.name.length <= 32, `${entry.name} name exceeds 32 chars`);
      } else {
        assert.equal(typeof entry.description, 'string', `${entry.name} must have a description`);
        assert.ok(entry.description.length > 0, `${entry.name} must have a non-empty description`);
        assert.ok(entry.description.length <= 100, `${entry.name} description exceeds 100 chars`);
        assert.ok(entry.name.length <= 32, `${entry.name} name exceeds 32 chars`);
        assert.match(entry.name, /^[a-z0-9_-]+$/, `${entry.name} contains invalid characters`);
      }
    }
  });

  await t.test('Message context menu translation command is registered', () => {
    const json = getCommandsJson();
    const ctx = json.find(isContextMenu);
    assert.ok(ctx, 'Expected at least one context menu command');
    assert.equal(ctx.type, 3, 'Translate context menu must be ApplicationCommandType.Message (3)');
    assert.equal(ctx.name, 'Translate to French');
  });

  await t.test('No duplicate command names registered', () => {
    const names = allCommandsList.map(c => c.data.name);
    const unique = new Set(names);
    assert.equal(unique.size, names.length, 'Duplicate slash command names detected');
  });

  await t.test('Collection loader maps every command by name', () => {
    const collection = loadCommands();
    assert.equal(collection.size, allCommandsList.length);
    assert.ok(collection.get('script'), '/script must be resolvable');
    assert.ok(collection.get('translate'), '/translate must be resolvable');
    assert.ok(collection.get('ticket'), '/ticket must be resolvable');
  });

  await t.test('Core feature commands from requirements are present', () => {
    const names = allCommandsList.map(c => c.data.name);
    const required = [
      'script',
      'setscript',
      'panel',
      'translate',
      'announce',
      'updates',
      'youtube',
      'role',
      'giveaway',
      'ticket',
      'verify',
      'welcome',
      'feedback',
      'ban',
      'kick',
      'timeout',
      'warn',
      'warnings',
      'purge',
      'slowmode',
      'modlogs',
      'help',
      'ping',
      'uptime',
      'serverinfo',
      'userinfo',
      'botinfo',
      'embed',
      'autoresponse',
      'branding',
      'setup',
      'backup',
    ];

    for (const cmd of required) {
      assert.ok(names.includes(cmd), `Required command /${cmd} is missing from the registry`);
    }
  });

  await t.test('Subcommand option descriptions stay within Discord limits', () => {
    const json = getCommandsJson();
    for (const entry of json) {
      if (!entry.options) continue;
      for (const opt of entry.options) {
        assert.ok(opt.name.length <= 32, `${entry.name} option ${opt.name} name too long`);
        assert.ok(
          !opt.description || opt.description.length <= 100,
          `${entry.name} option ${opt.name} description exceeds 100 chars`
        );
        if (opt.options) {
          for (const sub of opt.options) {
            assert.ok(sub.name.length <= 32, `${entry.name} ${opt.name} suboption ${sub.name} name too long`);
            if (sub.options) {
              for (const arg of sub.options) {
                assert.ok(arg.name.length <= 32, `${entry.name} ${opt.name} ${sub.name} arg ${arg.name} too long`);
                assert.ok(
                  !arg.description || arg.description.length <= 100,
                  `${entry.name} ${opt.name} ${sub.name} arg ${arg.name} description too long`
                );
              }
            }
          }
        }
      }
    }
  });
});
