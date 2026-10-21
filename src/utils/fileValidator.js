import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { config } from '../config.js';

export class FileSecurityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FileSecurityError';
  }
}

/**
 * Validates file extension against permitted list.
 * Returns lowercase normalized extension (e.g. '.lua').
 */
export function validateExtension(filename, allowedExtensions = config.storage.defaultAllowedExtensions) {
  if (!filename || typeof filename !== 'string') {
    throw new FileSecurityError('Filename is required.');
  }

  const ext = path.extname(filename).toLowerCase();
  if (!ext) {
    throw new FileSecurityError('File must have a valid extension (e.g., .lua, .txt).');
  }

  const normalizedAllowed = allowedExtensions.map(e => e.toLowerCase().startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`);
  if (!normalizedAllowed.includes(ext)) {
    throw new FileSecurityError(
      `File extension "${ext}" is not permitted. Allowed extensions: ${normalizedAllowed.join(', ')}`
    );
  }

  return ext;
}

/**
 * Strips dangerous characters and ensures no path traversal.
 * Returns safe base name without directory components.
 */
export function sanitizeFilename(originalName) {
  if (!originalName || typeof originalName !== 'string') {
    throw new FileSecurityError('Invalid filename provided.');
  }

  // Reject path traversal characters in original input
  if (originalName.includes('/') || originalName.includes('\\') || originalName.includes('..')) {
    throw new FileSecurityError('Path traversal characters detected in filename.');
  }

  // Remove null bytes and control characters
  const cleaned = originalName.replace(/[\x00-\x1F\x7F]/g, '');

  // Extract pure basename
  const base = path.basename(cleaned);

  if (base === '..' || base === '.') {
    throw new FileSecurityError('Path traversal characters detected in filename.');
  }

  // Sanitize to safe alphanumeric characters, dashes, underscores, and dots
  const sanitized = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!sanitized || sanitized.length === 0 || sanitized === '.') {
    return `script_${Date.now()}`;
  }

  return sanitized.slice(0, 100);
}

/**
 * Generates an isolated, safe storage path inside the designated scripts directory.
 * Prevents any path escape via path.resolve checks.
 */
export function generateSafeStoragePath(guildId, scriptId, version, extension) {
  const safeGuild = String(guildId).replace(/[^0-9]/g, '');
  const safeScriptId = String(scriptId).replace(/[^a-zA-Z0-9_-]/g, '');
  const safeVersion = String(version).replace(/[^a-zA-Z0-9._-]/g, '');
  const safeExt = extension.startsWith('.') ? extension : `.${extension}`;

  const targetDir = path.resolve(config.storage.scriptsDir, safeGuild);
  const targetFile = `${safeScriptId}_v${safeVersion}_${Date.now()}${safeExt}`;
  const fullPath = path.resolve(targetDir, targetFile);

  // Path boundary check: ensure fullPath is strictly inside targetDir
  if (!fullPath.startsWith(path.resolve(config.storage.scriptsDir))) {
    throw new FileSecurityError('Directory traversal vulnerability attempt blocked.');
  }

  return { targetDir, fullPath, filename: targetFile };
}

/**
 * Verifies that a given file path is strictly within the allowed storage root.
 */
export function assertPathInStorage(filePath) {
  const resolved = path.resolve(filePath);
  const root = path.resolve(config.storage.scriptsDir);
  if (!resolved.startsWith(root)) {
    throw new FileSecurityError('Access outside permitted storage boundary is denied.');
  }
  return resolved;
}

/**
 * Calculates SHA256 checksum of a buffer or file.
 */
export function computeHash(bufferOrString) {
  return crypto.createHash('sha256').update(bufferOrString).digest('hex');
}

/**
 * Ensures storage directories exist
 */
export function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
