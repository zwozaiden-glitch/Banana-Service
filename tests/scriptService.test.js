import test from 'node:test';
import assert from 'node:assert/strict';
import { ScriptService } from '../src/services/scriptService.js';
import { getDatabase } from '../src/database/db.js';
import fs from 'node:fs';

test('ScriptService CRUD, Versioning & Rollback', async (t) => {
  const guildId = `test_guild_scripts_${Date.now()}`;
  getDatabase(); // initialize db

  let scriptRecord;

  await t.test('Uploads a new valid Lua script', async () => {
    const content = Buffer.from('print("Hello from Banana Service Lua Script!")');
    scriptRecord = await ScriptService.uploadScript({
      guildId,
      name: 'Test Banana Automation',
      description: 'A test lua script',
      category: 'Utility',
      version: '1.0.0',
      originalFilename: 'auto.lua',
      buffer: content,
      uploaderId: '99999999',
      uploaderTag: 'Dev#0001',
    });

    assert.ok(scriptRecord.id > 0);
    assert.equal(scriptRecord.name, 'Test Banana Automation');
    assert.equal(scriptRecord.version, '1.0.0');
    assert.ok(fs.existsSync(scriptRecord.current_filename));
  });

  await t.test('Rejects duplicate script names/slugs in the same guild', async () => {
    const content = Buffer.from('print("duplicate")');
    await assert.rejects(async () => {
      await ScriptService.uploadScript({
        guildId,
        name: 'Test Banana Automation',
        originalFilename: 'auto2.lua',
        buffer: content,
        uploaderId: '99999999',
      });
    }, /already exists/);
  });

  await t.test('Updates script with version 1.1.0 and records changelog', async () => {
    const newContent = Buffer.from('print("Hello v1.1.0 Banana!")');
    const updated = await ScriptService.updateScript({
      guildId,
      scriptIdOrSlug: scriptRecord.id,
      version: '1.1.0',
      changelog: 'Added faster banana farming',
      originalFilename: 'auto_v1.1.lua',
      buffer: newContent,
      uploaderId: '99999999',
    });

    assert.equal(updated.version, '1.1.0');
    const versions = ScriptService.getVersions(scriptRecord.id);
    assert.equal(versions.length, 2);
    assert.equal(versions[0].version, '1.1.0');
    assert.equal(versions[1].version, '1.0.0');
  });

  await t.test('Lists scripts with category filter', () => {
    const list = ScriptService.listScripts(guildId, { category: 'Utility' });
    assert.equal(list.total, 1);
    assert.equal(list.items[0].name, 'Test Banana Automation');
  });

  await t.test('Rollbacks script to version 1.0.0', () => {
    const rolledBack = ScriptService.rollbackVersion(guildId, scriptRecord.id, '1.0.0');
    assert.equal(rolledBack.version, '1.0.0');
  });

  await t.test('Deletes script and cleans up version files', () => {
    const deleted = ScriptService.deleteScript(guildId, scriptRecord.id);
    assert.equal(deleted.id, scriptRecord.id);
    assert.equal(ScriptService.getScript(guildId, scriptRecord.id), undefined);
  });
});
