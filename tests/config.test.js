import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

test('Storage Configuration & Volume Relocation', async (t) => {
  await t.test('All writable artifacts live under one data root by default', async () => {
    const { config } = await import('../src/config.js');
    const { dataDir, dbPath, scriptsDir, transcriptsDir, backupsDir } = config.storage;

    assert.ok(path.isAbsolute(dataDir), 'dataDir must resolve to an absolute path');
    assert.ok(dbPath.startsWith(dataDir), `dbPath ${dbPath} must live under dataDir ${dataDir}`);
    assert.ok(scriptsDir.startsWith(dataDir), `scriptsDir must live under dataDir`);
    assert.ok(transcriptsDir.startsWith(dataDir), `transcriptsDir must live under dataDir`);
    assert.ok(backupsDir.startsWith(dataDir), `backupsDir must live under dataDir`);
  });

  await t.test('DATA_DIR relocates database, scripts, transcripts AND backups together', async () => {
    // Simulates a Railway volume mounted at /data
    process.env.DATA_DIR = '/data';
    process.env.DATABASE_PATH = '';
    process.env.STORAGE_DIR = '';
    process.env.TRANSCRIPTS_DIR = '';
    process.env.BACKUPS_DIR = '';

    // Cache-busting query forces a fresh module evaluation with the env applied
    const { config } = await import(`../src/config.js?v=${Date.now()}`);

    assert.equal(config.storage.dataDir, '/data');
    assert.equal(config.storage.dbPath, '/data/banana_service.db');
    assert.equal(config.storage.scriptsDir, '/data/scripts');
    assert.equal(config.storage.transcriptsDir, '/data/transcripts');
    assert.equal(config.storage.backupsDir, '/data/backups');

    delete process.env.DATA_DIR;
  });

  await t.test('Individual overrides still win over DATA_DIR', async () => {
    process.env.DATA_DIR = '/data';
    process.env.TRANSCRIPTS_DIR = '/mnt/archive/transcripts';

    const { config } = await import(`../src/config.js?v=${Date.now()}`);

    assert.equal(config.storage.dataDir, '/data');
    assert.equal(config.storage.dbPath, '/data/banana_service.db');
    assert.equal(config.storage.transcriptsDir, '/mnt/archive/transcripts');

    delete process.env.DATA_DIR;
    delete process.env.TRANSCRIPTS_DIR;
  });

  await t.test('Brand asset paths point at files that actually exist', async () => {
    const fs = await import('node:fs');
    const { config } = await import('../src/config.js');

    assert.ok(
      fs.existsSync(config.branding.avatarPath),
      `Branding avatarPath points at a missing file: ${config.branding.avatarPath}`
    );
    assert.ok(
      fs.existsSync(config.branding.bannerPath),
      `Branding bannerPath points at a missing file: ${config.branding.bannerPath}`
    );
  });

  await t.test('Script size cap and extension allowlist are configured', async () => {
    const { config } = await import('../src/config.js');

    assert.equal(config.storage.maxScriptSizeBytes, 8 * 1024 * 1024);
    assert.ok(config.storage.defaultAllowedExtensions.includes('.lua'));
    assert.ok(config.storage.defaultAllowedExtensions.includes('.txt'));
    assert.ok(!config.storage.defaultAllowedExtensions.includes('.exe'));
    assert.ok(!config.storage.defaultAllowedExtensions.includes('.sh'));
  });
});
