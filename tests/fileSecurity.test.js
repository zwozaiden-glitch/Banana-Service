import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateExtension,
  sanitizeFilename,
  generateSafeStoragePath,
  assertPathInStorage,
  FileSecurityError,
} from '../src/utils/fileValidator.js';
import { config } from '../src/config.js';

test('File Security & Path Traversal Protections', async (t) => {
  await t.test('Allows approved file extensions (.lua, .txt, .json)', () => {
    assert.equal(validateExtension('script.lua'), '.lua');
    assert.equal(validateExtension('config.TXT'), '.txt');
    assert.equal(validateExtension('data.json'), '.json');
  });

  await t.test('Rejects dangerous or unapproved file extensions (.exe, .sh, .bat)', () => {
    assert.throws(() => validateExtension('payload.exe'), FileSecurityError);
    assert.throws(() => validateExtension('install.sh'), FileSecurityError);
    assert.throws(() => validateExtension('exploit.bat'), FileSecurityError);
    assert.throws(() => validateExtension('noextension'), FileSecurityError);
  });

  await t.test('Sanitizes filenames and blocks directory traversal attempts', () => {
    assert.equal(sanitizeFilename('normal_script.lua'), 'normal_script.lua');
    assert.throws(() => sanitizeFilename('../../etc/passwd'), FileSecurityError);
    assert.throws(() => sanitizeFilename('..'), FileSecurityError);

    // Strips invalid characters
    const sanitized = sanitizeFilename('my banana script$#@! 1.lua');
    assert.ok(!sanitized.includes('$'));
    assert.ok(!sanitized.includes('@'));
  });

  await t.test('Safe storage path generates within designated directory', () => {
    const { fullPath, targetDir } = generateSafeStoragePath('12345', 42, '1.0.0', '.lua');
    assert.ok(fullPath.startsWith(config.storage.scriptsDir));
    assert.ok(targetDir.startsWith(config.storage.scriptsDir));
  });

  await t.test('assertPathInStorage blocks access outside scripts directory', () => {
    assert.throws(() => assertPathInStorage('/etc/shadow'), FileSecurityError);
    assert.throws(() => assertPathInStorage('/home/user/.bashrc'), FileSecurityError);
  });
});
